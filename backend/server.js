// ============================================================
// IMPORT DEPENDENCIES
// ============================================================

const express = require('express');           // web framework for node.js
const mysql = require('mysql2/promise');      // mySQL database client (promise-based)
const cors = require('cors');                 // cross-origin resource sharing middleware
const multer = require('multer');             // middleware for handling file uploads
const csv = require('csv-parser');            // library to parse CSV/TSV files
const { Transform } = require('stream');      // node.js for data transformation
const { Readable } = require('stream');       // node.js for reading data

// ============================================================
// EXPRESS APP INITIALIZATION
// ============================================================
const app = express();                        // create express app instance
const PORT = process.env.PORT || 5000;        // use env PORT or default to 5000

// ============================================================
// MIDDLEWARE SETUP
// ============================================================
app.use(cors());                              // enable CORS for frontend-backend communication
app.use(express.json());                      // parse JSON request bodies automatically

// ============================================================
// FILE UPLOAD CONFIGURATION (MEMORY STORAGE)
// ============================================================
const storage = multer.memoryStorage();       // store uploaded files in RAM

const upload = multer({ 

  storage: storage,                           // Use memory storage (no uploads folder)
  limits: {
    fileSize: 10 * 1024 * 1024,               // Max file size: 10MB (prevents large file abuse)
  },

  // validate file types before processing
  fileFilter: (req, file, cb) => {
    const validTypes = ['text/csv', 'text/tab-separated-values',
      'application/vnd.ms-excel', 'text/plain'];
    const validExtensions = ['.csv', '.tsv', '.txt'];
    
    // check both MIME type and file extension
    const hasValidType = validTypes.includes(file.mimetype);
    const hasValidExtension = validExtensions.some(ext => 
      file.originalname.toLowerCase().endsWith(ext)
    );
    
    // check if file valid, if yes accept, else rej
    if (hasValidType || hasValidExtension) {
      cb(null, true);

    } else {
      cb(new Error('Only CSV/TSV/TXT files are allowed!'), false);

    }
  }
});

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * removes BOM (Byte Order Mark) and trims whitespace from strings
 */
const cleanString = (str) => {

  if (!str) return '';
  // Remove BOM char if present
  return str.replace(/^\uFEFF/, '').trim();

};

/**
 * safely converts string to integer, returns null if conversion fails
 * handles empty strings and non-numeric values gracefully
 */
const toIntOrNull = (value) => {

  if (!value || value === '') return null;

  const cleaned = cleanString(value);
  const num = parseInt(cleaned, 10);

  return isNaN(num) ? null : num;

};

// ============================================================
// API ENDPOINTS
// ============================================================

/**
 * HEALTH CHECK ENDPOINT
 * GET /api/health
 * check for backend server is running and responsive (test endpoint)
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running properly.' });
});

/**
 * GET ALL DATA ENDPOINT
 * GET /api/data
 * retrieve all CSV data from database for frontend display
 */
app.get('/api/data', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute('SELECT * FROM data ORDER BY id ASC');
    await connection.end();
    res.json(rows);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * FILE UPLOAD ENDPOINT
 * POST /api/upload
 * process uploaded CSV/TSV files and insert data into database
 * (file → parse → clean → validate → insert → respond)
 */
app.post('/api/upload', upload.single('csvFile'), async (req, res) => {

  // check for file uploaded
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // file stored in memory as a buffer (binary)
  const fileBuffer = req.file.buffer;
  const originalName = req.file.originalname;

  const results = [];             // to store parsed CSV rows
  let connection;                 // db connection reference

  try {
    // convert binary to string (utf8)
    let fileContent = fileBuffer.toString('utf8');
    
    // remove BOM char if present
    if (fileContent.charCodeAt(0) === 0xFEFF) {
      fileContent = fileContent.slice(1);
      console.log('BOM detected and removed');
    }
    
    // check tab separator by reading first line
    const firstLine = fileContent.split('\n')[0];
    const separator = firstLine.includes('\t') ? '\t' : ',';
    
    // check if TSV or CSV
    console.log(`Processing: ${originalName}, Detected separator:`, 
                separator === '\t' ? 'TAB (TSV)' : 'COMMA (CSV)');

    // parse from memory buffer
    await new Promise((resolve, reject) => {

      // create readable stream from file
      const bufferStream = new Readable();

      bufferStream.push(fileContent); // push file content to stream
      bufferStream.push(null);        // signal end of data
      
      // stream process pipeline
      bufferStream
      
        // parse CSV/TSV w detected separator
        .pipe(csv({

          separator,
          skipEmptyLines: true,           // ignore empty rows
          trim: true                      // trim whitespace

        }))

        // transform stream for data cleaning
        .pipe(new Transform({

          objectMode: true,               // process obj

          transform(chunk, encoding, callback) {

            // clean all column names and values in each row
            const cleanedChunk = {};

            for (const [key, value] of Object.entries(chunk)) {
              const cleanedKey = cleanString(key);  // clean col names
              cleanedChunk[cleanedKey] = value;     // keep vals for now

            }

            callback(null, cleanedChunk);     // pass cleaned rows downstream

          }

        }))

        .on('data', (data) => results.push(data))   // collect parsed rows
        .on('end', resolve)                         // resolve when parsing complete
        .on('error', reject);                       // rej on parsing errors

    });

    // check if hv validated data
    if (results.length === 0) {
      return res.status(400).json({ error: 'File is empty or contains no valid data' });
    }

    // vonnect to db
    connection = await mysql.createConnection(dbConfig);

    // detect CSV structure for data
    const firstRow = results[0];
    const columns = Object.keys(firstRow);
    
    console.log('Columns detected:', columns);
    console.log('Total rows to process:', results.length);
    console.log('Sample data (first 2 rows):');
    results.slice(0, 2).forEach((row, idx) => {
      console.log(`  Row ${idx + 1}:`, row);
    });

    // insert data into db
    let insertedCount = 0;        // track successful inserts
    let errorCount = 0;           // track failed rows
    const errors = [];            // store error details
    
    // process each row sequentially (could be parallelized for performance)
    for (let i = 0; i < results.length; i++) {

      const row = results[i];

      try {

        // map CSV cols to db cols with flexible naming
        // try multiple possible column name variations
        const postId = toIntOrNull(
          row.postId || row.PostId || row.post_id || row.POSTID || ''
        );
        
        const id = toIntOrNull(
          row.id || row.Id || row.ID || ''
        );
        
        const name = cleanString(row.name || row.Name || row.NAME || '');
        const email = cleanString(row.email || row.Email || row.EMAIL || '');
        const body = cleanString(row.body || row.Body || row.BODY || '');

        // skip rows where id (pk) is null
        if (id === null) {

          console.log(`Skipping row ${i + 1} with null/invalid id:`, row);

          errorCount++;
          errors.push({ row: i + 1, reason: 'Invalid or missing id', data: row });

          continue;

        }

        // insert into db
        await connection.execute(
          'INSERT INTO data (postId, id, name, email, body) VALUES (?, ?, ?, ?, ?)',
          [postId, id, name, email, body]
        );

        insertedCount++;

        // catch individual row insertion errors
      } catch (err) {
        console.error(`Error inserting row ${i + 1}:`, err.message);
        errorCount++;
        errors.push({ row: i + 1, reason: err.message, data: row });
      }

    }

    // close db connection
    await connection.end();

    // for all success response
    const response = {
      success: true,
      message: `Successfully uploaded ${insertedCount} rows. ${errorCount} rows failed.`,
      rowsProcessed: results.length,                    // total rows in file
      rowsInserted: insertedCount,                      // successfully inserted
      rowsFailed: errorCount,                           // failed to insert
      columns: columns,                                 // detected col structure
      separator: separator === '\t' ? 'TAB' : 'COMMA',  // file format
      fileName: originalName                            // og filename
    };

    // restricts the number of error messages to appear
    if (errors.length > 0) { 
      response.sampleErrors = errors.slice(0, 3); 
    }

    // success response
    res.json(response);

  } catch (error) {
    console.error('Upload error:', error);
    
    // check database connection if it exists, if yes clean
    if (connection) { 
      try {
        await connection.end();
      } catch (connErr) {
        console.error('Error closing connection:', connErr);
      }
    }

    // error
    res.status(500).json({ 
      error: 'Failed to process file',
      details: error.message 
    });

  }

});

// clear all data endpoint
// empty the database table (reset functionality)
app.delete('/api/data', async (req, res) => {
  
  try {

    const connection = await mysql.createConnection(dbConfig);

    await connection.execute('DELETE FROM data');
    await connection.end();

    res.json({ success: true, message: 'All data cleared' });

  } catch (error) {

    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });

  }
});

// get data statistics
// retrieve metadata about stored data (row count)
app.get('/api/stats', async (req, res) => {

  try {

    const connection = await mysql.createConnection(dbConfig);
    const [countResult] = await connection.execute('SELECT COUNT(*) as total FROM data');

    await connection.end();
    
    // extract count from query result
    res.json({
      totalRows: countResult[0].total
    });

  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: error.message });

  }

});

// export helper functions AND app
module.exports = {
  cleanString,
  toIntOrNull,
  app
};

// only start server if NOT in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
    console.log(`Using MEMORY storage for uploads - no uploads folder created!`);
    console.log(`CSV/TSV Upload endpoint: http://localhost:${PORT}/api/upload`);
  });
}

// db config (keep at bottom or move to separate file)
// uses env variables with fallback defaults for local development
const dbConfig = {

  host: process.env.DB_HOST || 'database',      // db host (env or 'db')
  port: process.env.DB_PORT || 3306,            // mySQL (default:3306)
  user: process.env.DB_USER || 'root',          // db username
  password: process.env.DB_PASSWORD || 'root',  // db password
  database: process.env.DB_NAME || 'data'       // db/schema name

};
