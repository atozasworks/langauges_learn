// Fonts and languages for dropdowns
const googleDocFonts = [
  "Arial", "Calibri", "Cambria", "Comic Sans MS", "Courier New", "Georgia", "Impact", "Lucida Console", "Lucida Sans Unicode",
  "Microsoft Sans Serif", "Palatino Linotype", "Tahoma", "Times New Roman", "Trebuchet MS", "Verdana", "Abadi MT Condensed Extra Bold",
  "Abadi MT Condensed Light", "Algerian", "Andalus", "Angsana New", "AngsanaUPC", "Aparajita", "Arabic Typesetting", "Arial Black", "Arial Narrow",
  "Baskerville Old Face", "Batang", "Bell MT", "Berlin Sans FB", "Berlin Sans FB Demi", "Bernard MT Condensed", "Blackadder ITC", "Bodoni MT", "Bodoni MT Black", "Bodoni MT Condensed",
  "Bodoni MT Poster Compressed", "Book Antiqua", "Bookman Old Style", "Bradley Hand ITC", "Britannic Bold", "Broadway", "Brush Script MT", "Californian FB", "Candara",
  "Castellar", "Centaur", "Century Gothic", "Century Schoolbook", "Chiller", "Colonna MT", "Consolas", "Constantia", "Copperplate Gothic Bold",
  "Copperplate Gothic Light", "Corbel", "Cordia New", "CordiaUPC", "Courier", "Curlz MT", "DaunPenh", "David", "DilleniaUPC", "DokChampa", "Ebrima", "Edwardian Script ITC", "Eras Medium ITC",
  "Estrangelo Edessa", "EucrosiaUPC", "Felix Titling", "Footlight MT Light", "Forte", "Garamond", "Gautami", "Gisha", "Gloucester MT Extra Condensed", "Goudy Old Style", "Goudy Stout",
  "Gulim", "Haettenschweiler", "Harlow Solid Italic", "Harrington", "High Tower Text", "HoloLens MDL2 Assets", "Impact", "Imprint MT Shadow", "Informal Roman", "Ink Free", "Javanese Text",
  "Jokerman", "Juice ITC", "Kalinga", "Kartika", "Khmer UI", "Kristen ITC", "Kunstler Script", "Latha", "Leelawadee UI", "Lucida Bright", "Lucida Calligraphy", "Lucida Fax", "Lucida Handwriting",
  "Lucida Sans", "Lucida Sans Typewriter", "Magneto", "Maiandra GD", "Malgun Gothic", "Mangal", "Marlett", "Matura MT Script Capitals", "Meiryo", "Meiryo UI",
  "Microsoft Himalaya", "Microsoft JhengHei", "Microsoft YaHei", "Microsoft YaHei UI", "Microsoft Yi Baiti", "MingLiU-ExtB", "MingLiU_HKSCS", "Miriam", "Miriam Fixed",
  "Modern No. 20", "Mongolian Baiti", "Monotype Corsiva", "MS Gothic", "MS Mincho", "MS PGothic", "MS UI Gothic", "MV Boli", "Myanmar Text", "Nirmala UI", "OCR A Extended",
  "Old English Text MT", "Onyx", "Palatino Linotype", "Papyrus", "Poor Richard", "Pristina", "Rage Italic", "Ravenscroft", "Roboto", "Rockwell", "Rockwell Condensed", "Rockwell Extra Bold",
  "Rod", "Sakkal Majalla", "Segoe UI Semibold", "Segoe UI Semilight", "Segoe UI Symbol", "Shonar Bangla", "SimHei", "Simplified Arabic",
  "SimSun", "SimSun-ExtB", "Sistroen", "SketchFlow Grotesque", "Small Fonts", "Snap ITC", "Stencil", "Sylfaen", "Symbol", "Trebuchet MS",
  "Tunga", "Tw Cen MT", "Tw Cen MT Condensed", "Tw Cen MT Condensed Extra", "Ubuntu", "Ubuntu Mono", "Verdana", "Vijaya", "Viner Hand ITC", "Vivaldi", "Vladimir Script",
];

const pageSizes = {
  A4: { width: "210mm", height: "297mm" },
  Letter: { width: "216mm", height: "279mm" },
  Legal: { width: "216mm", height: "356mm" },
  Executive: { width: "184mm", height: "267mm" },
  Tabloid: { width: "279mm", height: "432mm" },
  A3: { width: "297mm", height: "420mm" },
  A5: { width: "148mm", height: "210mm" },
  B4: { width: "250mm", height: "353mm" },
  B5: { width: "176mm", height: "250mm" },
  Statement: { width: "140mm", height: "216mm" },
};

const LanguageCode = {
  ENGLISH: "en", AMHARIC: "am", ARABIC: "ar", BENGALI: "bn", CHINESE: "zh", GREEK: "el", GUJARATI: "gu",
  HINDI: "hi", KANNADA: "kn", MALAYALAM: "ml", MARATHI: "mr", NEPALI: "ne", ORIYA: "or", PERSIAN: "fa", PUNJABI: "pa",
  RUSSIAN: "ru", SANSKRIT: "sa", SINHALESE: "si", SERBIAN: "sr", TAMIL: "ta", TELUGU: "te", TIGRINYA: "ti", URDU: "ur",
};

const transliterableLanguages = [
  { language: "English", code: "en" },
  { language: "Amharic", code: "am" },
  { language: "Arabic", code: "ar" },
  { language: "Bengali", code: "bn" },
  { language: "Chinese", code: "zh" },
  { language: "Greek", code: "el" },
  { language: "Gujarati", code: "gu" },
  { language: "Hindi", code: "hi" },
  { language: "Kannada", code: "kn" },
  { language: "Malayalam", code: "ml" },
  { language: "Marathi", code: "mr" },
  { language: "Nepali", code: "ne" },
  { language: "Oriya", code: "or" },
  { language: "Persian", code: "fa" },
  { language: "Punjabi", code: "pa" },
  { language: "Russian", code: "ru" },
  { language: "Sanskrit", code: "sa" },
  { language: "Sinhalese", code: "si" },
  { language: "Serbian", code: "sr" },
  { language: "Tamil", code: "ta" },
  { language: "Telugu", code: "te" },
  { language: "Tigrinya", code: "ti" },
  { language: "Urdu", code: "ur" },
];

window.onload = function () {
  console.log('app.js loaded');

  const editor = document.getElementById("editor");

  // Populate page size selector
  const pageSizeSelector = document.getElementById("pageSizeSelector");
  Object.keys(pageSizes).forEach(size => {
    const opt = document.createElement("option");
    opt.value = size;
    opt.textContent = size;
    pageSizeSelector.appendChild(opt);
  });
  pageSizeSelector.value = "A4";

  // Populate language selector
  const languageSelector = document.getElementById("languageSelector");
  // Add a default option
  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = "Select Language";
  languageSelector.appendChild(defaultOpt);
  transliterableLanguages.forEach(lang => {
    const opt = document.createElement("option");
    opt.value = lang.code;
    opt.textContent = lang.language;
    languageSelector.appendChild(opt);
  });
  languageSelector.value = "hi";
  console.log('Language dropdown populated:', languageSelector.options.length);

  // Populate font size selector
  document.getElementById("fontSizeSelector").value = "16px";

  // Editor setup
  editor.style.fontSize = document.getElementById("fontSizeSelector").value;
  editor.style.width = pageSizes[pageSizeSelector.value].width;
  editor.style.minHeight = pageSizes[pageSizeSelector.value].height;
  // Set initial font and color from the new toolbar controls
  editor.style.fontFamily = document.getElementById("fontFamilySelector").value;
  editor.style.color = document.querySelector('.ql-color').value;

  // Toolbar events
  document.getElementById("fontSizeSelector").onchange = function () {
    editor.style.fontSize = this.value;
  };
  pageSizeSelector.onchange = function () {
    editor.style.width = pageSizes[this.value].width;
    editor.style.minHeight = pageSizes[this.value].height;
  };
  document.getElementById("orientationSelector").onchange = function () {
    const size = pageSizes[pageSizeSelector.value];
    if (this.value === "portrait") {
      editor.style.width = size.width;
      editor.style.minHeight = size.height;
    } else {
      editor.style.width = size.height;
      editor.style.minHeight = size.width;
    }
  };

  // Save document
  document.getElementById("saveBtn").onclick = async function () {
    try {
      const content = editor.innerHTML;
      const fileName = document.getElementById("fileName").value || "Untitled Document";
      
      // Create a Blob with the content
      const blob = new Blob([content], { type: "text/html" });
      
      // Show the save file picker with multiple format options
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: 'HTML Document',
            accept: {
              'text/html': ['.html']
            }
          },
          {
            description: 'PDF Document',
            accept: {
              'application/pdf': ['.pdf']
            }
          },
          {
            description: 'Text Document',
            accept: {
              'text/plain': ['.txt']
            }
          }
        ]
      });

      // Get the file extension from the handle
      const fileExtension = handle.name.split('.').pop().toLowerCase();
      
      // Create a FileSystemWritableFileStream to write to
      const writable = await handle.createWritable();
      
      // Convert content based on selected format
      let contentToWrite;
      if (fileExtension === 'pdf') {
        // For PDF, we'll need to convert the HTML content to PDF
        // This is a placeholder - you'll need to implement actual PDF conversion
        contentToWrite = new Blob([content], { type: 'application/pdf' });
      } else if (fileExtension === 'txt') {
        // For text, convert HTML to plain text
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        const plainText = tempDiv.textContent || tempDiv.innerText;
        contentToWrite = new Blob([plainText], { type: 'text/plain' });
      } else {
        // For HTML, use the original content
        contentToWrite = blob;
      }
      
      // Write the contents
      await writable.write(contentToWrite);
      // Close the file and write the contents to disk
      await writable.close();
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error saving file:', err);
        alert('Error saving file. Please try again.');
      }
    }
  };

  // Print document
  document.getElementById("printBtn").onclick = function () {
    const printWindow = window.open("", "", "width=800,height=600");
    printWindow.document.write(`
      <html>
      <head>
        <title>Print Document</title>
        <link rel="stylesheet" href="style.css">
      </head>
      <body>
        <div class="ql-editor">${editor.innerHTML}</div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Transliteration
  let transliterationControl = null;
  function initializeTransliteration() {
    if (!window.google || !window.google.elements || !window.google.elements.transliteration) {
      setTimeout(initializeTransliteration, 500);
      return;
    }
    const langCode = languageSelector.value;
    const options = {
      sourceLanguage: "en",
      destinationLanguage: [langCode],
      shortcutKey: "ctrl+g",
      transliterationEnabled: langCode !== "en",
    };
    transliterationControl = new window.google.elements.transliteration.TransliterationControl(options);
    transliterationControl.makeTransliteratable([editor]);
    if (langCode !== "en") transliterationControl.enableTransliteration();
    else transliterationControl.disableTransliteration();
  }
  function loadGoogleApi() {
    if (!window.google || !window.google.elements) {
      window.google.load("elements", "1", {
        packages: "transliteration",
        callback: initializeTransliteration,
      });
    } else {
      initializeTransliteration();
    }
  }
  loadGoogleApi();
  languageSelector.onchange = function () {
    initializeTransliteration();
  };

  // --- FullScreenDropdown logic ---
  renderFullScreenDropdown(window.languagesData, window.transliterableLanguages);

  function renderFullScreenDropdown(languagesData, transliterableLanguages) {
    const root = document.getElementById('dropdown-root');
    root.innerHTML = `
      <div class="dropdown-container">
        <button id="dropdownBtn" class="dropdown-button">
          <span id="dropdownSelected">Select Language</span>
          <span style="font-size:18px;">&#9660;</span>
        </button>
        <div id="dropdownOverlay" class="dropdown-overlay" style="display:none;">
          <div class="dropdown-content">
            <div class="dropdown-search">
              <input type="text" id="dropdownSearch" class="search-box" placeholder="Search..." />
              <button id="dropdownClose" class="dropdown-close">&times;</button>
            </div>
            <div class="alpha-filter" id="alphaFilter"></div>
            <div id="dropdownList" style="max-height:60vh;overflow:auto;text-align:left;"></div>
          </div>
        </div>
      </div>
    `;
    const btn = document.getElementById('dropdownBtn');
    const overlay = document.getElementById('dropdownOverlay');
    const closeBtn = document.getElementById('dropdownClose');
    const search = document.getElementById('dropdownSearch');
    const list = document.getElementById('dropdownList');
    const selected = document.getElementById('dropdownSelected');
    const alphaFilter = document.getElementById('alphaFilter');

    let filtered = languagesData;
    let activeAlphaFilter = '';

    // Populate alphabet filter
    for (let i = 65; i <= 90; i++) { // ASCII for A-Z
      const char = String.fromCharCode(i);
      const span = document.createElement('span');
      span.textContent = char;
      span.onclick = () => {
        activeAlphaFilter = char;
        search.value = ''; // Clear search when alpha filter is used
        renderList();
        // Update active class for styling
        Array.from(alphaFilter.children).forEach(child => {
          child.classList.remove('active');
        });
        span.classList.add('active');
      };
      alphaFilter.appendChild(span);
    }

    function renderList() {
      list.innerHTML = '';
      let currentFiltered = languagesData;

      if (activeAlphaFilter) {
        currentFiltered = currentFiltered.filter(lang => lang.display_name.startsWith(activeAlphaFilter));
      } else if (search.value) {
        const val = search.value.toLowerCase();
        currentFiltered = currentFiltered.filter(lang => lang.display_name.toLowerCase().includes(val));
      }

      currentFiltered.forEach(lang => {
        const isTrans = transliterableLanguages.some(t => t.language === lang.display_name);
        const item = document.createElement('div');
        item.textContent = lang.display_name + (isTrans ? ' 🌐' : '');
        item.style.padding = '8px 12px';
        item.style.cursor = 'pointer';
        item.onmouseover = () => item.style.background = '#e0eaff';
        item.onmouseout = () => item.style.background = '';
        item.onclick = () => {
          selected.textContent = lang.display_name;
          overlay.style.display = 'none';
          // Set language for transliteration
          document.getElementById('languageSelector').value = lang.lan_code || '';
          if (typeof initializeTransliteration === 'function') initializeTransliteration();
        };
        list.appendChild(item);
      });

      // If no languages found for the filter/search, display a message
      if (currentFiltered.length === 0) {
        const noResults = document.createElement('div');
        noResults.textContent = "No languages found.";
        noResults.style.textAlign = 'center';
        noResults.style.padding = '20px';
        noResults.style.color = '#888';
        list.appendChild(noResults);
      }
    }
    renderList();
    btn.onclick = () => { 
      overlay.style.display = 'flex'; 
      search.value = ''; 
      activeAlphaFilter = '';
      Array.from(alphaFilter.children).forEach(child => {
        child.classList.remove('active');
      });
      renderList(); 
      search.focus(); 
    };
    closeBtn.onclick = () => { overlay.style.display = 'none'; };
    overlay.onclick = e => { if (e.target === overlay) overlay.style.display = 'none'; };
    search.oninput = () => {
      activeAlphaFilter = ''; // Clear alpha filter when search is used
      Array.from(alphaFilter.children).forEach(child => {
        child.classList.remove('active');
      });
      renderList();
    };
  }

  // --- Text Editor Toolbar logic ---
  const fontFamilySelector = document.getElementById("fontFamilySelector");
  const textStyleSelector = document.getElementById("textStyleSelector");

  // Populate font family selector
  googleDocFonts.forEach(font => {
    const opt = document.createElement("option");
    opt.value = font;
    opt.textContent = font;
    fontFamilySelector.appendChild(opt);
  });
  fontFamilySelector.value = "Arial"; // Set default font

  fontFamilySelector.onchange = function() {
    editor.style.fontFamily = this.value;
    document.execCommand('fontName', false, this.value);
  };

  textStyleSelector.onchange = function() {
    const headerValue = this.value;
    if (headerValue) {
      document.execCommand('formatBlock', false, `<h${headerValue}>`);
    } else {
      document.execCommand('formatBlock', false, '<div>'); // Or <p> depending on desired default
    }
  };

  // Basic text formatting buttons
  document.querySelectorAll('.ql-bold').forEach(button => {
    button.onclick = () => document.execCommand('bold', false, null);
  });
  document.querySelectorAll('.ql-italic').forEach(button => {
    button.onclick = () => document.execCommand('italic', false, null);
  });
  document.querySelectorAll('.ql-underline').forEach(button => {
    button.onclick = () => document.execCommand('underline', false, null);
  });
  document.querySelectorAll('.ql-strike').forEach(button => {
    button.onclick = () => document.execCommand('strikeThrough', false, null);
  });
  document.querySelectorAll('.ql-link').forEach(button => {
    button.onclick = () => {
      const url = prompt('Enter the URL');
      if (url) document.execCommand('createLink', false, url);
    };
  });
  // Handle image insertion from file input
  const imageUploadInput = document.getElementById('imageUploadInput');
  document.querySelectorAll('.ql-image').forEach(button => {
    button.onclick = () => {
      imageUploadInput.click(); // Trigger the hidden file input
    };
  });

  imageUploadInput.onchange = function(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        const img = document.createElement('img');
        img.src = e.target.result;
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.display = 'block';
        img.style.margin = '10px auto';
        img.style.cursor = 'pointer';
        img.style.border = '1px solid transparent';
        img.style.transition = 'border-color 0.2s ease';

        // Insert the image at the current cursor position
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          range.insertNode(img);
          range.setStartAfter(img);
          range.setEndAfter(img);
          selection.removeAllRanges();
          selection.addRange(range);
        } else {
          editor.appendChild(img);
        }

        // Add click handler for image controls
        img.onclick = function(e) {
          e.stopPropagation();
          // Create and show controls
          const controls = document.createElement('div');
          controls.style.position = 'absolute';
          controls.style.top = `${e.clientY - 40}px`;
          controls.style.left = `${e.clientX}px`;
          controls.style.background = 'white';
          controls.style.padding = '5px';
          controls.style.border = '1px solid #ccc';
          controls.style.borderRadius = '4px';
          controls.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
          controls.style.zIndex = '1000';

          // Add alignment buttons
          const alignments = ['left', 'center', 'right'];
          alignments.forEach(align => {
            const btn = document.createElement('button');
            btn.textContent = align;
            btn.style.margin = '0 2px';
            btn.onclick = () => {
              img.style.margin = '10px auto';
              if (align === 'left') {
                img.style.marginRight = 'auto';
                img.style.marginLeft = '0';
              } else if (align === 'center') {
                img.style.marginLeft = 'auto';
                img.style.marginRight = 'auto';
              } else if (align === 'right') {
                img.style.marginLeft = 'auto';
                img.style.marginRight = '0';
              }
              document.body.removeChild(controls);
            };
            controls.appendChild(btn);
          });

          // Remove any existing controls
          const existingControls = document.querySelector('.image-controls');
          if (existingControls) {
            document.body.removeChild(existingControls);
          }

          // Add new controls to body
          controls.className = 'image-controls';
          document.body.appendChild(controls);

          // Remove controls when clicking outside
          const removeControls = (e) => {
            if (!controls.contains(e.target) && e.target !== img) {
              document.body.removeChild(controls);
              document.removeEventListener('click', removeControls);
            }
          };
          document.addEventListener('click', removeControls);
        };

        // Add resize functionality
        img.onmousedown = function(e) {
          if (e.target === img) {
            const startX = e.clientX;
            const startY = e.clientY;
            const startWidth = img.offsetWidth;
            const startHeight = img.offsetHeight;
            const aspectRatio = img.naturalWidth / img.naturalHeight;

            function resize(e) {
              const width = startWidth + (e.clientX - startX);
              const height = width / aspectRatio;
              img.style.width = `${width}px`;
              img.style.height = `${height}px`;
            }

            function stopResize() {
              window.removeEventListener('mousemove', resize);
              window.removeEventListener('mouseup', stopResize);
            }

            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResize);
          }
        };
      };
      reader.readAsDataURL(file);
    }
    this.value = null; // Clear the input
  };

  document.querySelectorAll('.ql-script').forEach(button => {
    button.onclick = () => {
      const scriptType = button.value;
      if (scriptType === 'sub') {
        document.execCommand('subscript', false, null);
      } else if (scriptType === 'super') {
        document.execCommand('superscript', false, null);
      }
    };
  });

  // List and indent buttons
  document.querySelectorAll('.ql-list[value="ordered"]').forEach(button => {
    button.onclick = () => document.execCommand('insertOrderedList', false, null);
  });
  document.querySelectorAll('.ql-list[value="bullet"]').forEach(button => {
    button.onclick = () => document.execCommand('insertUnorderedList', false, null);
  });
  // document.querySelectorAll('.ql-list[value="check"]').forEach(button => {
  //   button.onclick = () => document.execCommand('insertHTML', false, '<li><input type="checkbox"> </li>'); // This is a simplified example, a real checklist is more complex
  // });
  document.querySelectorAll('.ql-indent[value="-1"]').forEach(button => {
    button.onclick = () => document.execCommand('outdent', false, null);
  });
  document.querySelectorAll('.ql-indent[value="+1"]').forEach(button => {
    button.onclick = () => document.execCommand('indent', false, null);
  });

  // Alignment buttons
  document.querySelectorAll('.ql-align').forEach(button => {
    button.onclick = () => {
      const alignValue = button.value;
      document.execCommand('justify' + (alignValue.charAt(0).toUpperCase() + alignValue.slice(1)), false, null);
    };
  });

  // Text color and clean formatting
  document.querySelectorAll('.ql-color').forEach(input => {
    input.oninput = function() {
      document.execCommand('foreColor', false, this.value);
    };
  });
  document.querySelectorAll('.ql-clean').forEach(button => {
    button.onclick = () => document.execCommand('removeFormat', false, null);
  });

  // Set the editor to be contenteditable
  editor.contentEditable = true;
}
