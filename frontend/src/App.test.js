import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';

// mock global fetch API to avoid real HTTP reqs
// (prevents real HTTP requests during tests)
global.fetch = jest.fn();

// mock window.confirm for delete confirmation dialogs
global.confirm = jest.fn();

// mock URL.createObjectURL for file upload previews
global.URL.createObjectURL = jest.fn();

// main test suite for frontend
describe('CSV Data Application Tests', () => {

  // sample data (fake api responses)
  const mockData = [
    { id: 1, postId: 101, name: 'John Doe', email: 'john@test.com', body: 'Hello' },
    { id: 2, postId: 102, name: 'Jane Smith', email: 'jane@test.com', body: 'World' }
  ];
  
  const mockStats = { totalRows: 2 };

  // runs b4 each tests (for clean env)
  beforeEach(() => {

    // reset all jest mocks
    jest.clearAllMocks();
    
    // default mock for fetch API
    // (intercepts all HTTP requests, returns fake responses)
    fetch.mockImplementation((url) => {

      // mock GET data endpoint
      if (url.includes('/data')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockData)
        });
      }

      // mock GET stats endpoint
      if (url.includes('/stats')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockStats)
        });
      }

      // for unknown endpoints
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'Not found' })
      });

    });

    // for confirmation dialogs
    // (clicking "OK")
    global.confirm.mockReturnValue(true);
  });

  describe('Initial Loading and Basic Rendering', () => {

    // ============================================
    // TEST CASE 1: LOADING STATE
    // ============================================
    test('shows loading state initially', async () => {

      // mock slow API response
      fetch.mockImplementation(() => new Promise(resolve => 
        setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve([])
        }), 100)
      ));

      // rnder component
      render(<App />);
      
      // shld show loading msg
      expect(screen.getByText(/Loading.../i)).toBeInTheDocument();
      
      // wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText(/Loading.../i)).not.toBeInTheDocument();
      });

    });

    // ============================================
    // TEST CASE 2: MAIN APP STRUCTURE
    // ============================================
    test('renders main app structure after loading', async () => {
      
      // render component
      render(<App />);
      
      // wait to verify all main sections rendered
      await waitFor(() => {

        // main title
        expect(screen.getByText(/CSV Data Application/i)).toBeInTheDocument();

        // section headers
        expect(screen.getByText(/File Management/i)).toBeInTheDocument();
        expect(screen.getByText(/Data Information/i)).toBeInTheDocument();
        expect(screen.getByText(/Database Table Preview/i)).toBeInTheDocument();
      
      });

    });

  });

  describe('File Upload Functionality', () => {

    // ============================================
    // TEST CASE 3: UPLOAD BUTTON RENDERING
    // ============================================
    test('shows choose CSV file button', async () => {

      // render component
      render(<App />);
      
      // wait to verify upload button
      await waitFor(() => {
        const uploadButton = screen.getByText(/Choose CSV File/i);
        expect(uploadButton).toBeInTheDocument();
      });

    });

    // ============================================
    // TEST CASE 4: FILE TYPE VALIDATION
    // ============================================
    test('validates file type on upload', async () => {
      
      // render component
      render(<App />);
      
      // wait to verify file
      await waitFor(() => {

        // get hidden file input
        const fileInput = screen.getByLabelText(/Choose CSV File/i);
        
        // create non-csv file (in this case, pdf)
        const invalidFile = new File(['test'], 'test.pdf', { 
          type: 'application/pdf' 
        });
        
        // file selection
        fireEvent.change(fileInput, { target: { files: [invalidFile] } });
        
        // shld error
        expect(screen.getByText(/Please upload a CSV\/TSV file/i)).toBeInTheDocument();
      
      });

    });

  });

  describe('Data Management', () => {

    // ============================================
    // TEST CASE 5: CLEAR DATA BUTTON
    // ============================================
    test('shows clear data button', async () => {
      
      // render component
      render(<App />);
      
      // wait to verify clear data func
      await waitFor(() => {
        const clearButton = screen.getByText(/Clear All Data/i);
        expect(clearButton).toBeInTheDocument();
      });

    });

    // ============================================
    // TEST CASE 6: CONFIRMATION DIALOG
    // ============================================
    test('shows confirmation dialog before clearing data', async () => {
      
      // render component
      render(<App />);
      
      // wait to verify delete confirmation
      await waitFor(() => {

        const clearButton = screen.getByText(/Clear All Data/i);
        
        // mock user clicking "Cancel" in confirmation dialog
        global.confirm.mockReturnValueOnce(false);
        
        // click clear button
        fireEvent.click(clearButton);
        
        // shld NOT call delete API
        expect(fetch).not.toHaveBeenCalledWith(
          expect.stringContaining('/data'), 
          { method: 'DELETE' }
        );

      });

    });

  });

  describe('Search Functionality', () => {

    // ============================================
    // TEST CASE 7: SEARCH UI RENDERING
    // ============================================
    test('renders search input and dropdown', async () => {
      
      // render component
      render(<App />);
      
      // wait to verify search ui
      await waitFor(() => {

        // check search input
        expect(screen.getByPlaceholderText(/Search across all columns.../i))
          .toBeInTheDocument();

        // check search dropdown label
        expect(screen.getByText(/Search in:/i)).toBeInTheDocument();

        // check default dropdown value
        expect(screen.getByDisplayValue(/All Columns/i)).toBeInTheDocument();

      });

    });

    // ============================================
    // TEST CASE 8: SEARCH FILTERING
    // ============================================
    test('filters data by search query', async () => {
      
      // render component
      render(<App />);
      
      // wait to verify filter
      await waitFor(() => {

        const searchInput = screen.getByPlaceholderText(/Search across all columns.../i);
        
        // type "John" into search
        fireEvent.change(searchInput, { target: { value: 'John' } });
        
        // shld show search results count
        expect(screen.getByText(/Found 1 result/i)).toBeInTheDocument();

        // matched data should still be visible
        expect(screen.getByText(/John Doe/i)).toBeInTheDocument();

      });

    });

    // ============================================
    // TEST CASE 9: CLEAR SEARCH
    // ============================================
    test('clears search when X button is clicked', async () => {
      
      // render component
      render(<App />);
      
      // wait to verify search clearing
      await waitFor(() => {

        const searchInput = screen.getByPlaceholderText(/Search across all columns.../i);
        
        // enter search text
        fireEvent.change(searchInput, { target: { value: 'Test' } });
        expect(searchInput.value).toBe('Test');
        
        // click clear button (appears when text exists)
        const clearButton = screen.getByTitle(/Clear search/i);
        fireEvent.click(clearButton);
        
        // search shld be cleared
        expect(searchInput.value).toBe('');

      });

    });

  });

  describe('Error Handling', () => {

    // ============================================
    // TEST CASE 10: API FAILURE HANDLING
    // ============================================

    test('shows error message when fetch fails', async () => {

      // mock fetch to fail
      fetch.mockImplementation(() => Promise.reject(new Error('Network Error')));
      
      // render component
      render(<App />);
      
      // error msg shld show
      await waitFor(() => {
        expect(screen.getByText(/\[ERROR\] Network Error/i)).toBeInTheDocument();
      });

    });

  });

  describe('Empty States', () => {

    // ============================================
    // TEST CASE 11: NO DATA STATE
    // ============================================
    test('shows empty state when no data', async () => {

      // mock empty API responses
      fetch.mockImplementation((url) => {

        if (url.includes('/data')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([])
          });
        }

        if (url.includes('/stats')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ totalRows: 0 })
          });
        }

        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'Not found' })
        });

      });

      // render component
      render(<App />);
      
      // error msg shld show
      await waitFor(() => {
        expect(screen.getByText(/No data yet/i)).toBeInTheDocument();
        expect(screen.getByText(/Upload a CSV file./i)).toBeInTheDocument();
      });

    });

    // ============================================
    // TEST CASE 12: NO SEARCH RESULTS
    // ============================================
    test('shows no results for search', async () => {
      
      // render component
      render(<App />);
      
      // wait to verify ui (no results)
      await waitFor(() => {

        const searchInput = screen.getByPlaceholderText(/Search across all columns.../i);
        
        // search for non-existent term
        fireEvent.change(searchInput, { 
          target: { value: 'xyz123nonexistent' } 
        });
        
        // shld show "no results" msg
        expect(screen.getByText(/No results found/i)).toBeInTheDocument();
        expect(screen.getByText(/Try a different search term/i)).toBeInTheDocument();
      
      });

    });

  });

});
