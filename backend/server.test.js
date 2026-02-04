// ===========================================================
// server.test.js
// ===========================================================

// lib for http testing endpoints
const request = require('supertest');

// import the exported object from server.js
// in this case, server.js exports: { app, cleanString, toIntOrNull }
// for indiv exports
const serverExports = require('./server');
const { app, cleanString, toIntOrNull } = serverExports;

// mock mysql2/promise module so no nid connect to real db
// (replaces the real mysql2 with a fake ver)
jest.mock('mysql2/promise', () => ({
  createConnection: jest.fn()             // only createConnection func
}));

const mysql = require('mysql2/promise');  // imports the mock ver

// main test suite for backend API
describe('Backend API Tests', () => {

  let mockConnection;                     // stores all fake db connections

  // runs b4 each tests (for clean env)
  beforeEach(() => {

    // reset all jest mocks
    jest.clearAllMocks();
    
    // mock db connection obj w fake methods
    mockConnection = {
      execute: jest.fn(),               // mock execute() for sql
      end: jest.fn()                    // mock end() to close connection
    };
    
    // make mysql.createConnection return the mock connection
    // (simulates successful db connection)
    mysql.createConnection.mockResolvedValue(mockConnection);

  });

  describe('GET /api/health', () => {

    // ============================================
    // TEST CASE 1: HEALTH CHECK TEST
    // ============================================
    test('should return 200 and health status', async () => {

      // send GET req to health endpoint
      const response = await request(app).get('/api/health');
      
      expect(response.status).toBe(200);        // HTTP status shld b ok
      expect(response.body.status).toBe('ok');  // body shld hv 'ok'
      expect(response.body.message)             // verify msg
        .toBe('Backend is running properly.');

    });

  });

  describe('GET /api/data', () => {

    // ============================================
    // TEST CASE 2: DATA ENDPOINT RETRIEVAL FROM DB
    // ============================================
    test('should return all data from database', async () => {

      // mock data for fake db to return
      const mockData = [
        { id: 1, name: 'John', email: 'john@test.com' },
        { id: 2, name: 'Jane', email: 'jane@test.com' }
      ];
      
      // config mock to return fake data when calling execute()
      mockConnection.execute.mockResolvedValueOnce([mockData]);
      
      // send GET req to data endpoint
      const response = await request(app).get('/api/data');
      
      expect(response.status).toBe(200);        // shld succeed
      expect(response.body).toEqual(mockData);  // response shld match

      // check for the correct SQL query to bexecuted
      expect(mockConnection.execute).toHaveBeenCalledWith(
        'SELECT * FROM data ORDER BY id ASC'
      );

    });

    // ============================================
    // TEST CASE 3: DB ERROR HANDLING
    // ============================================
    test('should handle database errors gracefully', async () => {

      // force an error
      mockConnection.execute.mockRejectedValueOnce(new Error('DB connection failed'));
      
      // send GET req to data endpoint
      const response = await request(app).get('/api/data');
      
      expect(response.status).toBe(500);        // shld error
      expect(response.body.error)               // error msg shld show
        .toBe('DB connection failed');

    });

  });

  describe('DELETE /api/data', () => {

    // ============================================
    // TEST CASE 4: DATA DELETION CHECK
    // ============================================
    test('should clear all data successfully', async () => {

      mockConnection.execute.mockResolvedValueOnce([{}]);
      
      // send DELETE req to data endpoint
      const response = await request(app).delete('/api/data');
      
      expect(response.status).toBe(200);        // shld succeed
      expect(response.body.success).toBe(true); // success flag should be TRUE
      expect(response.body.message)             // confirm msg
        .toBe('All data cleared');

    });

    // ============================================
    // TEST CASE 5: DELETION FAILURE
    // ============================================
    test('should handle delete errors', async () => {
      
      // force deleting to fail
      mockConnection.execute.mockRejectedValueOnce(new Error('Delete failed'));
      
      // send DELETE req to data endpoint
      const response = await request(app).delete('/api/data');
      
      expect(response.status).toBe(500);        // sh;d error
      expect(response.body.error)               // error shld show
        .toBe('Delete failed');
        
    });

  });

  describe('GET /api/stats', () => {

    // ============================================
    // TEST CASE 6: GET STATS WITH DATA
    // ============================================
    test('should return row count statistics', async () => {

      // mock db returning count of 42 rows
      mockConnection.execute.mockResolvedValueOnce([[{ total: 42 }]]);
      
      // send GET req to stats endpoint
      const response = await request(app).get('/api/stats');
      
      expect(response.status).toBe(200);        // shld succeed
      expect(response.body.totalRows).toBe(42); // shld return correct count

    });

    // ============================================
    // TEST CASE 7: GET STATS WHEN DB IS EMPTY
    // ============================================
    test('should return 0 when no data exists', async () => {

      // mock empty db
      mockConnection.execute.mockResolvedValueOnce([[{ total: 0 }]]);
      
      // send GET req to stats endpoint
      const response = await request(app).get('/api/stats');
      
      expect(response.status).toBe(200);        // shld succeed
      expect(response.body.totalRows).toBe(0);  // shld return 0

    });

  });

  describe('POST /api/upload', () => {

    // ============================================
    // TEST CASE 8: MISSING FILE VALIDATION
    // ============================================
    test('should reject request without file', async () => {

      // send POST req wo attaching file
      const response = await request(app)
        .post('/api/upload')
        .send({});                              // empty body = no file
      
      expect(response.status).toBe(400);        // shld error
      expect(response.body.error)               // error shld show
        .toBe('No file uploaded');

    });

  });

  describe('Helper Functions', () => {

    // ============================================
    // TEST CASE 9: TEST CLEANSTRING()
    // ============================================
    test('cleanString removes BOM and trims', () => {

      // test w BOM char
      expect(cleanString('\uFEFF  hello  ')).toBe('hello');
      
      // test regular string w spaces
      expect(cleanString('  test  ')).toBe('test');
      
      // test empty/null edge cases
      expect(cleanString('')).toBe('');
      expect(cleanString(null)).toBe('');

    });

    // ============================================
    // TEST CASE 10: TEST TOINTORNULL()
    // ============================================
    test('toIntOrNull converts valid numbers', () => {

      // valid num conversions
      expect(toIntOrNull('123')).toBe(123);
      expect(toIntOrNull('  456  ')).toBe(456); // w space
      
      // invalid inputs shld return NULL
      expect(toIntOrNull('')).toBe(null);       // empty string
      expect(toIntOrNull('abc')).toBe(null);    // non-num
      expect(toIntOrNull(null)).toBe(null);     // NULL input
      
      expect(toIntOrNull('123.45')).toBe(123);  // integer part only
      
    });

  });

});
