const fs = require('fs');
const path = require('path');
const poppler = require('pdf-poppler');
const Tesseract = require('tesseract.js');
const { PDFDocument } = require('pdf-lib');

const pdfPath = 'file/test-file.pdf';
const outputDir = path.join(__dirname, 'output_images');
const outputTextFile = path.join(__dirname, 'extracted_text.txt');
const questionsOutputFile = path.join(__dirname, 'questions_and_options.txt');

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
    // for (let page = 3; page <= numPages; page++) {
    //     await processPage(page);
    // }
    // console.log('All pages processed');

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
    const questionsAndOptions = [];
    let currentQuestion = null;
    let collectingOptions = false;

    lines.forEach(line => {
        const questionMatch = line.match(/^\d+\.\s+(.+)/);
        const optionMatch = line.match(/^[A-D]\)\s+(.+)/);
        const romanMatch = line.match(/^(i{1,3}|iv|v)\.\s+(.+)/i);
        const arabicLikeMatch = line.match(/^(\d+)\)\s+(.+)/);

        if (questionMatch) {
            if (currentQuestion) {
                questionsAndOptions.push('---');
            }
            currentQuestion = `Question: ${questionMatch[1].trim()}`;
            questionsAndOptions.push(currentQuestion);
            collectingOptions = false;
        } else if (romanMatch && currentQuestion && !collectingOptions) {
            const romanPoint = `${romanMatch[1].trim()}. ${romanMatch[2].trim()}`;
            questionsAndOptions.push(romanPoint);
        } else if (arabicLikeMatch && currentQuestion && !collectingOptions) {
            // Treat patterns like 1), 2) as Roman numerals
            const romanNumeral = convertToRoman(arabicLikeMatch[1]);
            const romanPoint = `${romanNumeral}. ${arabicLikeMatch[2].trim()}`;
            questionsAndOptions.push(romanPoint);
        } else if (optionMatch && currentQuestion) {
            const option = `Option ${optionMatch[0].trim()}`;
            questionsAndOptions.push(option);
            collectingOptions = true;
        } else if (currentQuestion && !collectingOptions) {
            // Append additional lines to the current question
            questionsAndOptions[questionsAndOptions.length - 1] += ` ${line.trim()}`;
        } else if (questionMatch && currentQuestion) {
            // Treat the second question as part of the first question
            questionsAndOptions[questionsAndOptions.length - 1] += ` ${line.trim()}`;
        }
    });

    if (currentQuestion) {
        questionsAndOptions.push('---');
    }

    fs.writeFileSync(questionsOutputFile, questionsAndOptions.join('\n'), 'utf-8');
    console.log(`Questions and options written to ${questionsOutputFile}`);
};

// Helper function to convert Arabic numerals to Roman numerals
const convertToRoman = (num) => {
    const romanNumerals = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'];
    return romanNumerals[num - 1] || num;
};