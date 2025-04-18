import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const JSON_DATA_PATH = 'articles.json';
const CHANGED_FILES_ENV_VAR = 'CHANGED_FILES_LIST';


const genThumbnail = async (id, type, title, author) => {
  const htmlFilePath = 'template.html';
  const outputPath = `thumbnail/${id.replace(".md", "")}.jpeg`;
  const viewportWidth = 1200;
  const viewportHeight = 630;

  const imageFilePath = path.resolve(__dirname, `../type/${type ?? "objectt"}.png`);
  const imageBuffer = fs.readFileSync(imageFilePath);
  const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;

  const replaceParam = {
    "image": base64Image,
    "title": title ?? "タイトル",
    "author": author ?? "団体"
  };

  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  await page.setViewport({ width: viewportWidth, height: viewportHeight });
  console.log(`Viewport set to: ${viewportWidth}x${viewportHeight}`);

  console.log(`Loading HTML from: ${htmlFilePath}`);
  try {
    const htmlContent = fs.readFileSync(htmlFilePath, 'utf8').replaceAll(/{{\s*([\w-]+)\s*}}/g, (match, param) => {
      if (!replaceParam.hasOwnProperty(param)) return match;

      return replaceParam[param];
    });
    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
  } catch (error) {
    console.error(`Error reading or setting HTML content: ${error}`);
    await browser.close();
    process.exit(1);
  }

  console.log(`Taking screenshot and saving to: ${outputPath}`);
  try {
    await page.screenshot({
        path: outputPath,
        type: "jpeg",
        quality: 90
    });
  } catch (error) {
      console.error(`Error taking screenshot: ${error}`);
      await browser.close();
      process.exit(1);
  }


  await browser.close();
  console.log(`Screenshot saved successfully to ${outputPath}`);
};


async function filterArticles() {
  const changedFilesRaw = process.env[CHANGED_FILES_ENV_VAR];
  if (!changedFilesRaw) {
    console.log('Not found changed files.');
    console.log(JSON.stringify([], null, 2));
    process.exit(0);
  }

  const changedFilePaths = changedFilesRaw.split('\n').map(f => f.trim()).filter(Boolean);

  if (changedFilePaths.length === 0) {
    console.log(JSON.stringify([], null, 2));
    process.exit(0);
  }

  const changedBasenames = new Set(changedFilePaths.map(filePath => path.basename(filePath)));
  console.log('Changed files:', changedBasenames);

  let allArticles = [];
  try {
    const jsonData = fs.readFileSync(JSON_DATA_PATH, 'utf8');
    allArticles = JSON.parse(jsonData);
    if (!Array.isArray(allArticles)) {
      throw new Error('It is not array.');
    }
  } catch (error) {
    console.error(`${JSON_DATA_PATH}`, error);
    process.exit(1);
  }

  console.log(`Check the ${allArticles.length} article.`)
  for (const article of allArticles) {
    console.log(article);
    if (!article || typeof article.id !== 'string' || !changedBasenames.has(article.id)) continue;
    console.log("Mached article condition.")
    if (article.thumbnail) {
      console.log("Skip this article, it has thumbnail");
      continue;
    }

    console.log(`Found a updated file ${article.id}`)
    
    await genThumbnail(article.id, article.type, article.title, article.author);
  }
}

filterArticles().catch(error => {
  console.error(error);
  process.exit(1);
});