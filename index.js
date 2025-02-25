const fs = require('fs');
const path = require('path');
const poppler = require('pdf-poppler');
const Tesseract = require('tesseract.js');
const { PDFDocument } = require('pdf-lib');

const pdfPath = 'file/test-file.pdf';
const outputDir = path.join(__dirname, 'output_images');
const outputTextFile = path.join(__dirname, 'extracted_text.txt');
const questionsOutputFile = path.join(__dirname, 'questions_and_options.sql');

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
            const formattedPage = String(page).padStart(2, '0');
            const imagePath = path.join(outputDir, `output_page-${formattedPage}.jpg`);
            return Tesseract.recognize(
                imagePath,
                'mal+eng',
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
    for (let page = 3; page <= numPages; page++) {
        await processPage(page);
    }
    console.log('All pages processed');

    extractQuestionsAndOptions();
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


const extractQuestionsAndOptions = () => {
    const text = fs.readFileSync(outputTextFile, 'utf-8');
    const lines = text.split('\n');
    const sqlStatements = [];

    let question = "";
    let isCollectingQuestion = false;
    let options = { A: null, B: null, C: null, D: null };

    lines.forEach(line => {
        const questionMatch = line.match(/^\d+\.\s+(.+)/);
        let optionMatches = line.match(/([A-D©8])\)\s+([^A-D©8]+)/g);

        if (optionMatches) {
            optionMatches = optionMatches.map(option => {
                if (option.startsWith('©)')) {
                    return option.replace('©)', 'C)');
                } else if (option.startsWith('8)')) {
                    return option.replace('8)', 'B)');
                }
                return option;
            });
        }

        if (optionMatches == null && (questionMatch || isCollectingQuestion)) {
            isCollectingQuestion = true;
            if (questionMatch) {
                question += questionMatch[1].replace(/^\d+\)\s*/, '');
            } else {
                question += line;
            }
        }

        if (optionMatches) {
            isCollectingQuestion = false;
            optionMatches.forEach(option => {
                const optionMatch = option.match(/^([A-D])\)\s+(.+)/);
                if (optionMatch) {
                    options[optionMatch[1]] = optionMatch[2].trim().replace(/go/g, 'ഉം');
                }
            });
        }

        if (options.D) {
            sqlStatements.push(generateInsertStatement(question, options));
            question = "";
            options = { A: null, B: null, C: null, D: null };
        }
    });

    const sqlScript = sqlStatements.join('\n');
    fs.writeFileSync(questionsOutputFile, sqlScript, 'utf-8');
    console.log(`SQL script written to ${questionsOutputFile}`);
};

const generateInsertStatement = (question, options) => {
    return `INSERT INTO Question (QuestionText, OptionA, OptionB, OptionC, OptionD) VALUES ('${question.replace(/'/g, "''")}', '${(options.A || '').replace(/'/g, "''")}', '${(options.B || '').replace(/'/g, "''")}', '${(options.C || '').replace(/'/g, "''")}', '${(options.D || '').replace(/'/g, "''")}');`;
};

