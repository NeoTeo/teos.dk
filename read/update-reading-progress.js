// Function to parse the MD file content - written with Claude 3.7 Sonnet
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
    const entries = mdLines.map(parseMdLine);
    
    // Find the insertion point
    const inProgressPattern = /<i>in progress<\/i><br>/;
    const match = htmlFile.match(inProgressPattern);
    
    if (!match) {
      console.error("Could not find the 'in progress' section in the HTML file");
      return;
    }
    
    const insertPosition = match.index + match[0].length;
    
    // Generate the HTML for new entries
    let newEntriesHtml = "";
    entries.forEach(entry => {
      const progressBar = generateProgressBar(entry.progress);
      
      newEntriesHtml += `<div class="row">
<div class="author">${entry.author}, ${entry.title}</div>
<div class="progress">${progressBar}</div></div>
`;
    });
    
    // Insert the new entries at the right position
    const updatedHtml = htmlFile.slice(0, insertPosition) + 
                        newEntriesHtml + 
                        htmlFile.slice(insertPosition);
    
    // Write the updated HTML back to the file
    await fs.writeFile('readindex.html', updatedHtml);
    
    console.log("Successfully updated reading progress in readindex.html");
  } catch (error) {
    console.error("Error updating reading progress:", error);
  }
}

// Run the update function
updateReadingProgress();
