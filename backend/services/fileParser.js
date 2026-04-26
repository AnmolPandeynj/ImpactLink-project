const fs = require('fs');
const { parse } = require('csv-parse');
const XLSX = require('xlsx');

/**
 * STRATEGIC: Smart Column Detection
 * Analyzes headers to suggest likely field mappings.
 */
const detectColumns = (headers) => {
  const suggestions = {
    name: null,
    age: null,
    gender: null,
    phone: null,
    state: null,
    district: null,
    village: null,
    incomeRange: null,
    familySize: null,
    occupation: null,
    educationLevel: null,
    housingCondition: null,
    basicUtilities: null,
    primaryNeed: null,
    needSeverity: null,
    address: null,
    lat: null,
    lng: null
  };

  const patterns = {
    name: /name|beneficiary|person|recipient/i,
    age: /age|dob|birth/i,
    gender: /gender|sex/i,
    phone: /phone|contact|mobile|tel/i,
    state: /state|province/i,
    district: /district|county/i,
    village: /village|town|locality/i,
    incomeRange: /income|salary|earnings/i,
    familySize: /family|household|members/i,
    occupation: /occupation|work|job/i,
    educationLevel: /education|degree|qualification/i,
    housingCondition: /housing|house|dwelling/i,
    basicUtilities: /utilities|electricity|water|sanitation/i,
    primaryNeed: /need|requirement|help/i,
    needSeverity: /severity|priority|urgency/i,
    address: /address|location|addr/i,
    lat: /lat|latitude/i,
    lng: /lng|lon|longitude/i
  };

  headers.forEach(header => {
    Object.keys(patterns).forEach(field => {
      if (!suggestions[field] && patterns[field].test(header)) {
        suggestions[field] = header;
      }
    });
  });

  return suggestions;
};

/**
 * STRATEGIC: Streaming File Parser
 * Reads CSV or Excel files and returns a header-first preview or a full stream.
 */
const getFilePreview = async (filePath) => {
  const ext = filePath.split('.').pop().toLowerCase();
  
  if (ext === 'csv') {
    return new Promise((resolve, reject) => {
      const records = [];
      const parser = fs.createReadStream(filePath).pipe(parse({
        columns: true,
        to: 5 // Just first 5 rows for preview
      }));
      
      parser.on('data', (row) => records.push(row));
      parser.on('end', () => {
        const headers = records.length > 0 ? Object.keys(records[0]) : [];
        resolve({ headers, preview: records, suggestions: detectColumns(headers) });
      });
      parser.on('error', reject);
    });
  } else if (['xlsx', 'xls'].includes(ext)) {
    // Read only the first 100 rows to determine headers and preview
    const workbook = XLSX.readFile(filePath, { sheetRows: 100 });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const records = XLSX.utils.sheet_to_json(sheet, { range: 0, defval: '' });
    
    const headers = records.length > 0 ? Object.keys(records[0]) : [];
    return { 
      headers, 
      preview: records.slice(0, 50), // Return up to 50 for frontend preview
      suggestions: detectColumns(headers) 
    };
  }
};

module.exports = { getFilePreview, detectColumns };
