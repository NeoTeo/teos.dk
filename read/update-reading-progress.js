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
  
  return {
    author: result[0],
    title: result[1],
    progress: parseInt(result[2])
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
  
  // Extract all row entries
  const rowPattern = /<div class="row">[\s\S]*?<div class="author">(.*?)<\/div>[\s\S]*?<div class="progress">(.*?)<\/div><\/div>/g;
  
  const existingEntries = [];
  let rowMatch;
  
  while ((rowMatch = rowPattern.exec(inProgressSection)) !== null) {
    const fullAuthorTitle = rowMatch[1].trim();
    const progressBar = rowMatch[2].trim();
    
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
  
  mdEntries.forEach(mdEntry => {
    // Find if this entry already exists
    const existingEntry = existingEntries.find(entry => 
      entry.author === mdEntry.author && entry.title === mdEntry.title
    );
    
    if (!existingEntry) {
      // New entry to add
      entriesToAdd.push(mdEntry);
    } else if (existingEntry.progress !== mdEntry.progress) {
      // Entry exists but progress changed
      entriesToUpdate.push({
        ...mdEntry,
        existingMatch: existingEntry.fullMatch
      });
    }
  });
  
  return { entriesToAdd, entriesToUpdate };
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

// Main function to update the HTML with entries from the MD file
async function updateReadingProgress() {
  try {
    // Read the files
    const fs = require('fs').promises;
    const htmlFile = await fs.readFile('readindex.html', 'utf8');
    const mdFile = await fs.readFile('readingprogress.md', 'utf8');
    
    // Parse the MD file
    const mdLines = mdFile.trim().split('\n');
    const mdEntries = mdLines.map(parseMdLine);
    
    // Extract existing entries
    const { entries: existingEntries, inProgressIndex } = extractExistingEntries(htmlFile);
    
    if (inProgressIndex === -1) {
      console.error("Could not find the 'in progress' section in the HTML file");
      return;
    }
    
    // Determine what needs to be added or updated
    const { entriesToAdd, entriesToUpdate } = determineChanges(mdEntries, existingEntries);
    
    let updatedHtml = htmlFile;
    
    // First, update existing entries with new progress
    entriesToUpdate.forEach(entry => {
      const newProgressBar = generateProgressBar(entry.progress);
      const newRowHtml = `<div class="row">
<div class="author">${entry.author}, ${entry.title}</div>
<div class="progress">${newProgressBar}</div></div>`;
      
      updatedHtml = updatedHtml.replace(entry.existingMatch, newRowHtml);
    });
    
    // Then add new entries at the beginning of the section
    if (entriesToAdd.length > 0) {
      let newEntriesHtml = "";
      entriesToAdd.forEach(entry => {
        const progressBar = generateProgressBar(entry.progress);
        newEntriesHtml += `<div class="row">
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
    
    console.log(`Successfully updated reading progress in readindex.html:
- ${entriesToAdd.length} new entries added
- ${entriesToUpdate.length} existing entries updated`);
  } catch (error) {
    console.error("Error updating reading progress:", error);
  }
}

// Run the update function
updateReadingProgress();
