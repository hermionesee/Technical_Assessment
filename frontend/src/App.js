import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css';

function App() {

  // ============================================================
  // STATE MANAGEMENT
  // ============================================================
  const [data, setData] = useState([]);                           // core data state

  const [stats, setStats] = useState({ totalRows: 0,              // store metadata like total
    lastUpdated: null });                                         // row and last updated

  const [loading, setLoading] = useState(true);                   // ui loading
  const [error, setError] = useState(null);                       // error handler

  // upload states
  const [uploading, setUploading] = useState(false);              // file upload
  const [uploadMessage, setUploadMessage] = useState('');         // upload status msg

  const [lastUploadedFile, setLastUploadedFile] = useState(null); // dup prevention
  
  // pagination state
  const [currentPage, setCurrentPage] = useState(1);              // tracks page user is on
  const [rowsPerPage, setRowsPerPage] = useState(10);             // num of row displayed
  
  // search state
  const [searchQuery, setSearchQuery] = useState('');             // user's search
  const [searchColumn, setSearchColumn] = useState('all');        // 'all' or specific column
  const [isSearching, setIsSearching] = useState(false);          // ui searching

  // environment variable for backend API base url
  const API_URL = process.env.REACT_APP_API_URL;

  // ============================================================
  // FUNCTIONALITIES OF THE APP
  // ============================================================

  /**
   * fetches all CSV data from backend API
   * wrapped in useCallback to prevent unnecessary re-renders
   */
  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/data`);
      if (!response.ok) throw new Error('Failed to fetch data');
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [API_URL]);

  /**
   * fetches statistics (total rows) from backend
   * wrapped in useCallback for performance
   */
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/stats`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      const result = await response.json();
      setStats(result);
    } catch (err) {
      console.error('Stats error:', err);
    }
  }, [API_URL]);

  /**
   * useEffect hook that runs once on component mount
   * fetches initial data and stats
   */
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchData();
      await fetchStats();
      setLoading(false);
    };
    loadData();
  }, [fetchData, fetchStats]);

  /**
   * handles CSV file upload with dup prevention
   * @param {Event} event - file input change event
   */
  const handleFileUpload = async (event) => {

    const file = event.target.files[0];
    if (!file) return;

    // check if file is legitimate
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.tsv') && !file.name.endsWith('.txt')) {
      setUploadMessage('Please upload a CSV/TSV file');
      return;
    }

    // check for same file
    if (lastUploadedFile && 
        lastUploadedFile.name === file.name && 
        lastUploadedFile.size === file.size &&
        lastUploadedFile.lastModified === file.lastModified) {

      setUploadMessage('[ERROR] This file was just uploaded. Please select a different file.');
      event.target.value = '';
      return;

    }

    setUploading(true);
    setUploadMessage('');

    // to hadle binary files
    const formData = new FormData();            // formData instance
    formData.append('csvFile', file);           // preserve binary file data

    // send file to backend API
    try {
      const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setUploadMessage(`[SUCCESS] ${result.message}`);

        await fetchData();          // refresh table data
        await fetchStats();         // refresh stats

        setCurrentPage(1);          // reset to page 1
        
        setLastUploadedFile(file);  // store ref to last uploaded file
        setSearchQuery('');         // clear any active search

      } else {
        setUploadMessage(`[ERROR] ${result.error}`);

      }

    } catch (err) {
      setUploadMessage(`[ERROR] Upload failed: ${err.message}`);

    } finally {
      setUploading(false);          // reset ui
      event.target.value = '';      // clear file input

    }

  };

  /**
   * Clears all data from database with confirmation dialog
   */
  const handleClearData = async () => {
    if (!window.confirm('Are you sure you want to clear all data?')) return;

    try {
      const response = await fetch(`${API_URL}/data`, { method: 'DELETE' });

      if (response.ok) {

        setUploadMessage('[SUCCESS] All data cleared');

        setLastUploadedFile(null);  // clear file reference

        await fetchData();          // refresh table data
        await fetchStats();         // refresh stats

        setCurrentPage(1);          // reset to page 1

        setSearchQuery('');         // clear any active search

      } else {
        setUploadMessage('[ERROR] Failed to clear data');

      }

    } catch (err) {
      setUploadMessage(`[ERROR] ${err.message}`);

    }

  };

  /**
   * converts text with \n characters to React elements with line breaks
   * @param {string} text - text containing \n line break characters
   * @returns {React.Fragment} - react elements with <br /> tags
   */
  const renderWithLineBreaks = (text) => {
    if (!text) return '';
    return text.split('\\n').map((line, index, array) => (
      <React.Fragment key={index}>
        {line}
        {index < array.length - 1 && <br />}
      </React.Fragment>
    ));
  };

  /**
   * filters data based on search query and selected column
   * optimized with useMemo to prevent recalculating on every render
   */
  const filteredData = useMemo(() => {

    // check if got search query
    if (!searchQuery.trim()) return data;
    
    // search indicator
    setIsSearching(true);
    const query = searchQuery.toLowerCase().trim();
    
    // filter based on search
    const filtered = data.filter(row => {

      if (searchColumn === 'all') {

        // search in all cols
        return Object.values(row).some(value => 
          String(value).toLowerCase().includes(query)
        );

      } else {

        // search in specific col specified
        const columnValue = row[searchColumn.toLowerCase()] || row[searchColumn] || '';
        return String(columnValue).toLowerCase().includes(query);

      }

    });
    
    // for searchin timeout loading
    setTimeout(() => setIsSearching(false), 100);
    return filtered;

  }, [data, searchQuery, searchColumn]);



  // ============================================================
  // PAGINATION STUFF
  // ============================================================
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = filteredData.slice(indexOfFirstRow, indexOfLastRow);

  // reset to page 1 when search changes to prevent empty pages
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, searchColumn]);

  // page change
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);

  };

  // rows per page change
  const handleRowsPerPageChange = (event) => {

    setRowsPerPage(Number(event.target.value));
    setCurrentPage(1);

  };

  // get page numbers for pagination
  const getPageNumbers = () => {

    const pageNumbers = [];
    const maxVisiblePages = 5;          // bottom max 5 pages shown
    
    if (totalPages <= maxVisiblePages) {

      // if total pages lesser than default max
      // just show ALL pages
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }

    } else {

      // for large data sets
      if (currentPage <= 3) {

        for (let i = 1; i <= 4; i++) {
          pageNumbers.push(i);
        }

        pageNumbers.push('...');
        pageNumbers.push(totalPages);

      } else if (currentPage >= totalPages - 2) {

        pageNumbers.push(1);
        pageNumbers.push('...');

        for (let i = totalPages - 3; i <= totalPages; i++) {
          pageNumbers.push(i);
        }

      } else {

        pageNumbers.push(1);
        pageNumbers.push('...');

        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pageNumbers.push(i);
        }

        pageNumbers.push('...');
        pageNumbers.push(totalPages);

      }

    }
    
    return pageNumbers;

  };

  // ============================================================
  // LOADING STATE
  // ============================================================
  if (loading) {
    return (
      <div className="App">
        <header className="App-header">
          <h1>CSV Data Application</h1>
          <p>Loading...</p>
        </header>
      </div>
    );
  }

  // ============================================================
  // SEARCH STUFF
  // ============================================================

  // search input change with delayed update
  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
  };

  // search column change
  const handleSearchColumnChange = (event) => {
    setSearchColumn(event.target.value);
  };

  // clear search
  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchColumn('all');
  };

  // ============================================================
  // APPLICATION UI STUFF
  // ============================================================

  return (
    <div className="App">
      <header className="App-header">
        <h1>CSV Data Application</h1>
      </header>

      <main className="App-main">

        {/* file managing section */}
        <section className="app-group" aria-label="File management">
          <h2 className="group-title">File Management</h2>
          <div className="upload-section">
            <div className="upload-controls">
              <label htmlFor="csv-upload" className="upload-button">
                {uploading ? 'Uploading...' : 'Choose CSV File'}
              </label>
              <input
                id="csv-upload"
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={handleFileUpload}
                disabled={uploading}
                style={{ display: 'none' }}
              />
              <button
                onClick={handleClearData}
                className="clear-button"
                disabled={uploading || data.length === 0}
              >
                Clear All Data
              </button>
            </div>
            {uploadMessage && (
              <div
                className={`upload-message ${
                  uploadMessage.startsWith('[SUCCESS]') ? 'success' : 'error'
                }`}
              >
                {uploadMessage}
              </div>
            )}
          </div>
        </section>

        {/* data info section */}
        <section className="app-group" aria-label="Data overview">
          <h2 className="group-title">Data Information</h2>
          
          <div className="stats-section">
            <div className="stat-card">
              <div className="stat-label">Total Rows</div>
              <div className="stat-value">{stats.totalRows}</div>
            </div>
          </div>

          <div className="search-section">
            <div className="search-header">

              <h3>Search Data</h3>

              <div className="search-options">
                <label htmlFor="search-column">Search in:</label>

                <select
                  id="search-column"
                  value={searchColumn}
                  onChange={handleSearchColumnChange}
                  className="search-column-select"
                  disabled={data.length === 0}
                >

                  <option value="all">All Columns</option>
                  <option value="postId">Post ID</option>
                  <option value="id">ID</option>
                  <option value="name">Name</option>
                  <option value="email">Email</option>
                  <option value="body">Body</option>

                </select>

              </div>
            </div>
            
            <div className="search-input-group">
              <input
                type="text"
                placeholder="Search across all columns..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="search-input"
                disabled={data.length === 0}
              />
              {searchQuery && (
                <button
                  onClick={handleClearSearch}
                  className="clear-search-button"
                  title="Clear search"
                >
                  X
                </button>
              )}
            </div>
            
            {isSearching && (
              <div className="searching-indicator">
                Searching...
              </div>
            )}
            
            {searchQuery && (
              <div className="search-info">
                Found {filteredData.length} result{filteredData.length !== 1 ? 's' : ''} for "{searchQuery}" 
                {searchColumn !== 'all' && ` in ${searchColumn} column`}
              </div>
            )}
          </div>
        </section>

        {/* db table section */}
        <section className="app-group" aria-label="Data preview">
          <h2 className="group-title">Database Table Preview</h2>
          <div className="data-section">
            {error && (
              <div className="error-message">
                <p>[ERROR] {error}</p>
              </div>
            )}
            {!error && data.length === 0 ? (
              <div className="empty-state">
                <p>No data yet</p>
                <p>Upload a CSV file.</p>
              </div>
            ) : !error && searchQuery && filteredData.length === 0 ? (
              <div className="empty-state">
                <p>No results found</p>
                <p>Try a different search term or search in all columns.</p>
              </div>
            ) : (
              <>
                {/* Rows per page selector and search info */}
                <div className="pagination-controls-top">
                  <div className="rows-per-page">
                    <label htmlFor="rows-per-page">Rows per page:</label>
                    <select 
                      id="rows-per-page" 
                      value={rowsPerPage} 
                      onChange={handleRowsPerPageChange}
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                  <div className="pagination-info">
                    Showing {indexOfFirstRow + 1} to {Math.min(indexOfLastRow, filteredData.length)} of {filteredData.length} row{filteredData.length !== 1 ? 's' : ''}
                    {searchQuery && ' (filtered)'}
                  </div>
                </div>

                <div className="data-container">
                  <table>
                    <thead>
                      <tr>
                        <th>POSTID</th>
                        <th>ID</th>
                        <th>NAME</th>
                        <th>EMAIL</th>
                        <th>BODY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.postId}</td>
                          <td>{row.id}</td>
                          <td>{row.name}</td>
                          <td>{row.email}</td>
                          <td className="body-cell">{renderWithLineBreaks(row.body)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination controls */}
                {totalPages > 1 && (
                  <div className="pagination">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="pagination-button"
                    >
                      Previous
                    </button>
                    
                    {getPageNumbers().map((pageNum, index) => (
                      pageNum === '...' ? (
                        <span key={`ellipsis-${index}`} className="pagination-ellipsis">...</span>
                      ) : (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`pagination-button ${currentPage === pageNum ? 'active' : ''}`}
                        >
                          {pageNum}
                        </button>
                      )
                    ))}
                    
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="pagination-button"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
