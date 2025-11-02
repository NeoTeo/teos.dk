// Function to normalize ISBN by removing hyphens
function normalizeIsbn(isbn) {
  return isbn ? isbn.replace(/-/g, '') : '';
}

// Function to parse the MD file content
function parseMdLine(line) {
  let result = [];
  let current = "";
  let escaped = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    
    if (char === '\\') {
      escaped = true;
      continue;
    }
    
    if (char === ',' && !escaped) {
      result.push(current.trim());
      current = "";
      continue;
    }
    
    current += char;
  }
  
  if (current.trim()) {
    result.push(current.trim());
  }
  
  // Parse the NofN format for progress
  const progressStr = result[2];
  const progressMatch = progressStr.match(/(\d+)of(\d+)/);
  
  let progress = 1; // Default to 1 if parsing fails
  let isCompleted = false;
  let currentPage = 0;
  let totalPages = 0;
  
  if (progressMatch) {
    currentPage = parseInt(progressMatch[1]);
    totalPages = parseInt(progressMatch[2]);
    isCompleted = currentPage >= totalPages;
    
    if (!isCompleted) {
      const percentage = (currentPage / totalPages) * 100;
      // Convert percentage to 1-10 scale (0-10% = 1, 11-20% = 2, etc.)
      progress = Math.min(10, Math.max(1, Math.ceil(percentage / 10)));
    }
  }
  
  return {
    author: result[0],
    title: result[1],
    progress: progress,
    isCompleted: isCompleted,
    currentPage: currentPage,
    totalPages: totalPages,
    progressStr: progressStr
  };
}

// Function to extract existing entries from the HTML
function extractExistingEntries(html) {
  // Look for the "in progress" section
  const inProgressPattern = /<i>in progress<\/i><br>/;
  const match = html.match(inProgressPattern);

  if (!match) {
    return { entries: [], inProgressIndex: -1 };
  }

  const inProgressIndex = match.index + match[0].length;

  // Find the end of the "in progress" section - either next <br><br> or </p>
  const endSectionPattern = /<br><br>|<\/p>/;
  const endMatch = html.substring(inProgressIndex).match(endSectionPattern);

  const endIndex = endMatch
    ? inProgressIndex + endMatch.index
    : html.length;

  const inProgressSection = html.substring(inProgressIndex, endIndex);

  // Extract all row entries - updated to capture data-pagecount
  const rowPattern = /<div class="row"(?:\s+data-isbn10="([^"]*)")?(?:\s+data-pagecount="([^"]*)")?>[\s\S]*?<div class="author">(.*?)<\/div>[\s\S]*?<div class="progress">(.*?)<\/div><\/div>/g;

  const existingEntries = [];
  let rowMatch;

  while ((rowMatch = rowPattern.exec(inProgressSection)) !== null) {
    const isbn10 = normalizeIsbn(rowMatch[1] || '');
    const pageCount = rowMatch[2] ? parseInt(rowMatch[2]) : null;
    const fullAuthorTitle = rowMatch[3].trim();
    const progressBar = rowMatch[4].trim();

    // Parse author and title
    const lastCommaIndex = fullAuthorTitle.lastIndexOf(', ');
    if (lastCommaIndex !== -1) {
      const author = fullAuthorTitle.substring(0, lastCommaIndex);
      const title = fullAuthorTitle.substring(lastCommaIndex + 2);

      // Extract progress from progress bar (position of *)
      const progressMatch = progressBar.match(/I(-*)(\*)(-*)I/);
      const progress = progressMatch ? progressMatch[1].length + 1 : 0;

      existingEntries.push({
        author,
        title,
        progress,
        pageCount,
        isbn10,
        fullMatch: rowMatch[0],
        authorTitleText: fullAuthorTitle
      });
    }
  }

  return {
    entries: existingEntries,
    inProgressIndex,
    endSectionIndex: endIndex
  };
}

// Function to determine which entries need to be added or updated
function determineChanges(mdEntries, existingEntries) {
  const entriesToAdd = [];
  const entriesToUpdate = [];
  const completedEntries = [];

  mdEntries.forEach(mdEntry => {
    // Find if this entry already exists
    const existingEntry = existingEntries.find(entry =>
      entry.author === mdEntry.author && entry.title === mdEntry.title
    );

    if (mdEntry.isCompleted) {
      // Book is completed, mark for removal and completion handling
      completedEntries.push({
        ...mdEntry,
        isbn10: existingEntry ? existingEntry.isbn10 : '',
        existingMatch: existingEntry ? existingEntry.fullMatch : null
      });
    } else if (!existingEntry) {
      // New entry to add
      entriesToAdd.push(mdEntry);
    } else if (existingEntry.progress !== mdEntry.progress || existingEntry.pageCount !== mdEntry.totalPages) {
      // Entry exists but progress or page count changed
      entriesToUpdate.push({
        ...mdEntry,
        isbn10: existingEntry.isbn10,
        existingMatch: existingEntry.fullMatch
      });
    }
  });

  return { entriesToAdd, entriesToUpdate, completedEntries };
}

// Function to generate progress bar
function generateProgressBar(progress) {
  const totalSpaces = 10;
  const position = progress;
  
  let progressBar = "I";
  for (let i = 1; i <= totalSpaces; i++) {
    progressBar += (i === position) ? "*" : "-";
  }
  progressBar += "I";
  
  return progressBar;
}

// Function to handle completed books
async function handleCompletedBooks(completedEntries) {
  if (completedEntries.length === 0) return 0;
  
  const fs = require('fs').promises;
  const path = require('path');
  
  // Read the readingprogress.md file to remove completed books
  const mdContent = await fs.readFile('readingprogress.md', 'utf8');
  let updatedMdContent = mdContent;
  
  // Read the main readindex.html to add completed books
  const readIndexContent = await fs.readFile('readindex.html', 'utf8');
  let updatedReadIndexContent = readIndexContent;
  
  // Get current year
  const currentYear = new Date().getFullYear();
  
  for (const completedBook of completedEntries) {
    // Remove from readingprogress.md
    const lineToRemove = `${completedBook.author}, ${completedBook.title}, ${completedBook.progressStr}`;
    updatedMdContent = updatedMdContent.replace(lineToRemove + '\n', '');
    updatedMdContent = updatedMdContent.replace(lineToRemove, '');
    
    // Add to readindex.html right after the year header (as first entry)
    const yearPattern = new RegExp(`(<b>${currentYear}</b><br>)`, 'i');
    const yearMatch = updatedReadIndexContent.match(yearPattern);
    
    if (yearMatch) {
      const normalizedIsbn = normalizeIsbn(completedBook.isbn10);
      const isbn10Attr = normalizedIsbn ? ` data-isbn10="${normalizedIsbn}"` : '';
      const pageCountAttr = ` data-pagecount="${completedBook.totalPages}"`;
      const bookEntry = `\t<span data-book${isbn10Attr}${pageCountAttr}>${completedBook.author}, ${completedBook.title}</span><br>\n`;
      const replacement = yearMatch[1] + bookEntry;
      updatedReadIndexContent = updatedReadIndexContent.replace(yearMatch[0], replacement);
    }
    
    // Update index.html "recently read >" line
    const indexContent = await fs.readFile('../index.html', 'utf8');
    const recentlyReadPattern = /(<a class="no-underline" href="read\/readindex\.html"><b>Recently read ><\/b><\/a><br>\s*<p>\s*<i>)[^<]*(<\/i><br>)/;
    const updatedIndexContent = indexContent.replace(
      recentlyReadPattern, 
      `$1${completedBook.author}, ${completedBook.title}$2`
    );
    await fs.writeFile('../index.html', updatedIndexContent);
  }
  
  // Write updated files
  await fs.writeFile('readingprogress.md', updatedMdContent.trim() + '\n');
  await fs.writeFile('readindex.html', updatedReadIndexContent);
  
  return completedEntries.length;
}

// Function to detect duplicate books
function detectDuplicates(mdEntries) {
  const seen = new Map();
  const duplicates = [];

  mdEntries.forEach((entry, index) => {
    const key = `${entry.author}|||${entry.title}`;

    if (seen.has(key)) {
      duplicates.push({
        author: entry.author,
        title: entry.title,
        lineNumbers: [seen.get(key) + 1, index + 1]
      });
    } else {
      seen.set(key, index);
    }
  });

  return duplicates;
}

// Main function to update the HTML with entries from the MD file
async function updateReadingProgress() {
  try {
    // Read the files
    const fs = require('fs').promises;
    const htmlFile = await fs.readFile('readindex.html', 'utf8');
    const mdFile = await fs.readFile('readingprogress.md', 'utf8');

    // Parse the MD file
    const mdLines = mdFile.trim().split('\n').filter(line => line.trim() !== '');
    const mdEntries = mdLines.map(parseMdLine);

    // Check for duplicates
    const duplicates = detectDuplicates(mdEntries);
    if (duplicates.length > 0) {
      console.warn('\n⚠️  WARNING: Duplicate books found in readingprogress.md:\n');
      duplicates.forEach(dup => {
        console.warn(`   "${dup.author}, ${dup.title}" appears on lines ${dup.lineNumbers.join(' and ')}`);
      });
      console.warn('\n   Please remove duplicate entries before continuing.\n');
      return;
    }
    
    // Extract existing entries
    const { entries: existingEntries, inProgressIndex } = extractExistingEntries(htmlFile);
    
    if (inProgressIndex === -1) {
      console.error("Could not find the 'in progress' section in the HTML file");
      return;
    }
    
    // Determine what needs to be added or updated
    const { entriesToAdd, entriesToUpdate, completedEntries } = determineChanges(mdEntries, existingEntries);
    
    // Handle completed books first
    const completedCount = await handleCompletedBooks(completedEntries);
    
    // Re-read the HTML file after handling completed books
    const updatedHtmlFile = await fs.readFile('readindex.html', 'utf8');
    let updatedHtml = updatedHtmlFile;
    
    // Remove completed books from in-progress section
    completedEntries.forEach(entry => {
      if (entry.existingMatch) {
        updatedHtml = updatedHtml.replace(entry.existingMatch, '');
      }
    });
    
    // Update existing entries with new progress
    entriesToUpdate.forEach(entry => {
      const newProgressBar = generateProgressBar(entry.progress);
      const normalizedIsbn = normalizeIsbn(entry.isbn10);
      const isbn10Attr = normalizedIsbn ? ` data-isbn10="${normalizedIsbn}"` : '';
      const pageCountAttr = ` data-pagecount="${entry.totalPages}"`;
      const newRowHtml = `<div class="row"${isbn10Attr}${pageCountAttr}>
<div class="author">${entry.author}, ${entry.title}</div>
<div class="progress">${newProgressBar}</div></div>`;

      updatedHtml = updatedHtml.replace(entry.existingMatch, newRowHtml);
    });
    
    // Add new entries at the beginning of the section
    if (entriesToAdd.length > 0) {
      let newEntriesHtml = "";
      entriesToAdd.forEach(entry => {
        const progressBar = generateProgressBar(entry.progress);
        const pageCountAttr = ` data-pagecount="${entry.totalPages}"`;
        newEntriesHtml += `<div class="row" data-isbn10=""${pageCountAttr}>
<div class="author">${entry.author}, ${entry.title}</div>
<div class="progress">${progressBar}</div></div>
`;
      });
      
      // Insert at the beginning of the in-progress section
      const insertPosition = inProgressIndex;
      updatedHtml = updatedHtml.slice(0, insertPosition) + 
                    newEntriesHtml + 
                    updatedHtml.slice(insertPosition);
    }
    
    // Write the updated HTML back to the file
    await fs.writeFile('readindex.html', updatedHtml);
    
    console.log(`Successfully updated reading progress:
- ${entriesToAdd.length} new entries added
- ${entriesToUpdate.length} existing entries updated
- ${completedCount} books completed and moved`);
  } catch (error) {
    console.error("Error updating reading progress:", error);
  }
}

// Run the update function
updateReadingProgress();
