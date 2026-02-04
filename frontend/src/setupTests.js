// frontend/src/setupTests.js
import '@testing-library/jest-dom';

// mock fetch
global.fetch = jest.fn();

// mock window.URL
global.URL.createObjectURL = jest.fn(() => 'mock-url');

// mock window.confirm
global.confirm = jest.fn();

// suppress console errors during tests
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

// restore console.error to its og implementation
afterEach(() => {
  console.error.mockRestore();
});
