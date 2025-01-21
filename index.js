const fs = require('fs');
const path = require('path');
const poppler = require('pdf-poppler');
const Tesseract = require('tesseract.js');
const { PDFDocument } = require('pdf-lib');

const pdfPath = 'file/test-file.pdf';
const outputDir = path.join(__dirname, 'output_images');
const outputTextFile = path.join(__dirname, 'extracted_text.txt');

// Ensure the output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Function to process each page
const processPage = (page) => {
  const options = {
    format: 'jpg',
    out_dir: outputDir,
    out_prefix: `output_page`,
    page: page,
  };

  return poppler.convert(pdfPath, options)
    .then(() => {
      console.log(`Page ${page} converted to image`);
      const imagePath = path.join(outputDir, `output_page-${page}.jpg`);
      return Tesseract.recognize(
        imagePath,
        'mal',
        {
          logger: (m) => console.log(m),
        }
      );
    })
    .then(({ data: { text } }) => {
      console.log(`Extracted text from page ${page}`);
      fs.appendFileSync(outputTextFile, text + '\n', (err) => {
        if (err) {
          console.error('Error appending text to file:', err);
        }
      });
    })
    .catch((err) => {
      console.error(`Error processing page ${page}:`, err);
    });
};

// Function to process all pages
const processAllPages = async (numPages) => {
  for (let page = 1; page <= numPages; page++) {
    await processPage(page);
  }
  console.log('All pages processed');
};

// Function to get the number of pages in the PDF
const getNumberOfPages = async (pdfPath) => {
  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  return pdfDoc.getPageCount();
};

// Start processing
getNumberOfPages(pdfPath)
  .then((numPages) => {
    console.log(`Number of pages in PDF: ${numPages}`);
    processAllPages(numPages);
  })
  .catch((err) => {
    console.error('Error getting number of pages:', err);
  });