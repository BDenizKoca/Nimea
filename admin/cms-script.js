// This script will run when the CMS is loaded
// It adds some additional functionality to ensure content changes are properly reflected

window.addEventListener('DOMContentLoaded', (event) => {
  // Initialize CMS
  
  // If using NetlifyCMS/DecapCMS
  if (window.CMS) {
    // Add a listener for new entry creation
    window.CMS.registerEventListener({
      name: 'prePublish',
      handler: async ({ entry }) => {
        return entry;
      },
    });
    
    // Register a successful callback when entry is saved
    window.CMS.registerEventListener({
      name: 'preSave',
      handler: async ({ entry }) => {
        const entryData = entry.get('data').toJS();
        
        if (!entryData.slug) {
          alert('Please provide a slug (URL-friendly name) for this entry.');
          return Promise.reject('Missing slug in entry data!');
        }
        
        return entry;
      },
    });
    
    window.CMS.registerEventListener({
      name: 'postSave',
      handler: async ({ entry }) => {
        const entryData = entry.get('data').toJS();
        const collection = entry.get('collection');
        
        alert(`'${entryData.name}' in ${collection} was saved successfully. The admin page will now reload to reflect the latest changes.`);
        // Force the browser to refresh to pick up the new file
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      },
    });

    // Custom Image Insertion Helper
    setupImageInsertionHelper();
    
    // Image Click-to-Edit functionality
    setupImageEditingHelper();
    
    // Enhance sync scroll functionality
    enhanceSyncScroll();
  }
});

function setupImageInsertionHelper() {
  // Wait for the editor to be ready
  setTimeout(() => {
    addImageInsertionButton();
  }, 2000);
}

function setupImageEditingHelper() {
  console.log('🚀 Setting up image editing helper...');
  // Wait for the editor to be ready, then set up click handlers
  setTimeout(() => {
    console.log('⏰ Timeout reached, adding image click handlers...');
    addImageClickHandlers();
  }, 3000);
}

function addImageInsertionButton() {
  console.log('🖼️ Adding image insertion buttons...');
  
  // Find all markdown editors
  const markdownEditors = document.querySelectorAll('[data-testid="richtext"] .CodeMirror, .CodeMirror');
  console.log(`📝 Found ${markdownEditors.length} editors to enhance`);
  
  markdownEditors.forEach((editor, index) => {
    if (editor.dataset.imageHelperAdded) {
      console.log(`⏭️ Editor ${index} already has image helper`);
      return; // Don't add multiple times
    }
    editor.dataset.imageHelperAdded = 'true';
    
    console.log(`➕ Adding image insertion button to editor ${index}`);
    
    // Create image insertion button
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 1000;
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 2px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;
    
    const imageButton = document.createElement('button');
    imageButton.innerHTML = '🖼️ Insert Image';
    imageButton.type = 'button';
    imageButton.style.cssText = `
      background: #3f51b5;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
      font-weight: bold;
    `;
    
    imageButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('🎯 Image button clicked, opening modal...');
      showImageInsertionModal(editor);
    });
    
    buttonContainer.appendChild(imageButton);
    
    // Add to editor container
    const editorContainer = editor.closest('.CodeMirror') || editor;
    editorContainer.style.position = 'relative';
    editorContainer.appendChild(buttonContainer);
    
    console.log(`✅ Successfully added image button to editor ${index}`);
  });
  
  // Re-run periodically to catch new editors
  setTimeout(addImageInsertionButton, 3000);
}

function showImageInsertionModal(editor) {
  console.log('🎬 Opening image insertion modal...');
  
  // Create modal overlay
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.7);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: white;
    padding: 30px;
    border-radius: 8px;
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  `;
  
  modalContent.innerHTML = `
    <h2 style="margin-top: 0; color: #333; font-family: sans-serif;">🖼️ Insert Image</h2>
    <p style="color: #666; margin-bottom: 25px;">Add an image to your content with custom alignment and sizing options.</p>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
      <div>
        <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">Image URL or Path:</label>
        <input type="text" id="imageUrl" placeholder="/images/filename.jpg" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
        <small style="color: #666; font-size: 12px;">Upload images first via the media library, then reference them here</small>
      </div>
      
      <div>
        <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">Alt Text (Required):</label>
        <input type="text" id="altText" placeholder="Describe the image for accessibility" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
        <small style="color: #666; font-size: 12px;">Describes the image for screen readers and SEO</small>
      </div>
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
      <div>
        <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">Alignment:</label>
        <select id="alignment" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
          <option value="">Default (full width)</option>
          <option value="image-left">Float Left (text wraps right)</option>
          <option value="image-right">Float Right (text wraps left)</option>
          <option value="image-center">Center (no text wrapping)</option>
        </select>
      </div>
      
      <div>
        <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">Size:</label>
        <select id="size" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
          <option value="">Default (auto-size)</option>
          <option value="image-small">Small (max 200px wide)</option>
          <option value="image-medium">Medium (max 400px wide)</option>
          <option value="image-large">Large (max 600px wide)</option>
        </select>
      </div>
    </div>
    
    <div style="margin-bottom: 25px;">
      <h3 style="color: #333; font-size: 16px; margin-bottom: 10px;">📋 Markdown Preview:</h3>
      <div id="previewContainer" style="background: #f8f9fa; padding: 15px; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 13px; color: #495057; border: 1px solid #e9ecef; word-break: break-all;">
        ![Alt text](/images/filename.jpg)
      </div>
      <small style="color: #666; font-size: 12px;">This is the markdown that will be inserted into your content</small>
    </div>
    
    <div style="display: flex; gap: 15px; justify-content: flex-end;">
      <button id="cancelBtn" style="padding: 12px 24px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer; font-size: 14px; color: #666;">Cancel</button>
      <button id="insertBtn" style="padding: 12px 24px; border: none; background: #3f51b5; color: white; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 14px;">Insert Image</button>
    </div>
  `;
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  console.log('✅ Modal created and added to DOM');
  console.log('✅ Modal created and added to DOM');
  
  // Set up event listeners
  const imageUrlInput = modal.querySelector('#imageUrl');
  const altTextInput = modal.querySelector('#altText');
  const alignmentSelect = modal.querySelector('#alignment');
  const sizeSelect = modal.querySelector('#size');
  const previewContainer = modal.querySelector('#previewContainer');
  const cancelBtn = modal.querySelector('#cancelBtn');
  const insertBtn = modal.querySelector('#insertBtn');
  
  // Update preview function
  function updatePreview() {
    const url = imageUrlInput.value.trim() || '/images/filename.jpg';
    const alt = altTextInput.value.trim() || 'Alt text';
    const alignment = alignmentSelect.value;
    const size = sizeSelect.value;
    
    let classes = [];
    if (alignment) classes.push(alignment);
    if (size) classes.push(size);
    
    const classString = classes.length > 0 ? `{.${classes.join(' .')}}` : '';
    const markdown = `![${alt}](${url})${classString}`;
    
    previewContainer.textContent = markdown;
    
    // Update insert button state
    const hasRequiredFields = url && alt;
    insertBtn.disabled = !hasRequiredFields;
    insertBtn.style.opacity = hasRequiredFields ? '1' : '0.5';
    insertBtn.style.cursor = hasRequiredFields ? 'pointer' : 'not-allowed';
  }
  
  // Set up event listeners for real-time preview
  imageUrlInput.addEventListener('input', updatePreview);
  altTextInput.addEventListener('input', updatePreview);
  alignmentSelect.addEventListener('change', updatePreview);
  sizeSelect.addEventListener('change', updatePreview);
  
  // Initial preview update
  updatePreview();
  
  // Cancel button
  cancelBtn.addEventListener('click', () => {
    console.log('❌ Image insertion cancelled');
    document.body.removeChild(modal);
  });
  
  // Insert button
  insertBtn.addEventListener('click', () => {
    const url = imageUrlInput.value.trim();
    const alt = altTextInput.value.trim();
    
    console.log('🔍 Validating image insertion...', { url, alt });
    
    if (!url) {
      alert('⚠️ Please enter an image URL or path');
      imageUrlInput.focus();
      return;
    }
    
    if (!alt) {
      alert('⚠️ Please enter alt text for accessibility');
      altTextInput.focus();
      return;
    }
    
    const alignment = alignmentSelect.value;
    const size = sizeSelect.value;
    
    let classes = [];
    if (alignment) classes.push(alignment);
    if (size) classes.push(size);
    
    const classString = classes.length > 0 ? `{.${classes.join(' .')}}` : '';
    const markdown = `![${alt}](${url})${classString}`;
    
    console.log('📝 Inserting markdown:', markdown);
    
    // Insert into editor
    const success = insertTextIntoEditor(editor, markdown);
    
    if (success) {
      console.log('✅ Image successfully inserted');
      // Close modal
      document.body.removeChild(modal);
    } else {
      console.error('❌ Failed to insert image');
      alert('❌ Failed to insert image. Please try again.');
    }
  });
  
  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      console.log('🖱️ Modal closed by clicking overlay');
      document.body.removeChild(modal);
    }
  });
  
  // Focus the URL input and show helpful tip
  imageUrlInput.focus();
  
  // Add helpful keyboard shortcuts
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.body.removeChild(modal);
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      insertBtn.click();
    }
  });
  
  console.log('🎮 Event listeners set up, modal ready for interaction');
}

function insertTextIntoEditor(editor, text) {
  console.log('📝 Attempting to insert text into editor:', text);
  
  // Get CodeMirror instance
  let codeMirror;
  if (editor.CodeMirror) {
    codeMirror = editor.CodeMirror;
    console.log('✅ Found CodeMirror instance on editor element');
  } else {
    // Try to find CodeMirror instance
    const cmElement = editor.closest('.CodeMirror');
    if (cmElement && cmElement.CodeMirror) {
      codeMirror = cmElement.CodeMirror;
      console.log('✅ Found CodeMirror instance on parent element');
    }
  }
  
  if (codeMirror) {
    try {
      // Insert at cursor position
      const cursor = codeMirror.getCursor();
      console.log('📍 Cursor position:', cursor);
      
      // Add some spacing if not at beginning of line
      let textToInsert = text;
      if (cursor.ch > 0) {
        textToInsert = '\n\n' + text + '\n\n';
      } else {
        textToInsert = text + '\n\n';
      }
      
      codeMirror.replaceRange(textToInsert, cursor);
      codeMirror.focus();
      
      console.log('✅ Successfully inserted text via CodeMirror');
      return true;
    } catch (error) {
      console.error('❌ Error inserting text via CodeMirror:', error);
    }
  } else {
    console.log('⚠️ CodeMirror not found, trying fallback methods...');
    
    // Fallback: try to find textarea and insert
    const textarea = editor.querySelector('textarea') || 
                     editor.closest('.form-control') || 
                     document.querySelector('textarea[data-testid="markdown"]') ||
                     document.querySelector('textarea');
    
    if (textarea) {
      try {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;
        
        // Add some spacing
        let textToInsert = text;
        if (start > 0 && value[start - 1] !== '\n') {
          textToInsert = '\n\n' + text + '\n\n';
        } else {
          textToInsert = text + '\n\n';
        }
        
        textarea.value = value.substring(0, start) + textToInsert + value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + textToInsert.length;
        textarea.focus();
        
        // Trigger change event
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        
        console.log('✅ Successfully inserted text via textarea fallback');
        return true;
      } catch (error) {
        console.error('❌ Error inserting text via textarea fallback:', error);
      }
    }
  }
  
  console.error('❌ Could not find any editor to insert text into');
  return false;
}

function addImageClickHandlers() {
  console.log('🔧 Setting up image click handlers...');
  
  // Find all CodeMirror editors
  const editors = document.querySelectorAll('.CodeMirror');
  console.log(`📝 Found ${editors.length} CodeMirror editors`);
  
  editors.forEach((editor, index) => {
    if (editor.dataset.imageClickHandlerAdded) return;
    editor.dataset.imageClickHandlerAdded = 'true';
    
    const codeMirror = editor.CodeMirror;
    if (!codeMirror) {
      console.log(`⚠️ No CodeMirror instance found for editor ${index}`);
      return;
    }
    
    console.log(`✅ Adding click handlers to editor ${index}`);
    
    // Add click handler to CodeMirror
    codeMirror.on('cursorActivity', (cm) => {
      const cursor = cm.getCursor();
      const line = cm.getLine(cursor.line);
      const imageMatch = findImageAtCursor(line, cursor.ch);
      
      if (imageMatch) {
        // Add visual indicator that this image is clickable
        addImageClickIndicator(cm, cursor.line, imageMatch);
      }
    });
    
    // Add single click handler for better UX
    codeMirror.on('mousedown', (cm, event) => {
      const pos = cm.coordsChar({left: event.clientX, top: event.clientY});
      const line = cm.getLine(pos.line);
      const imageMatch = findImageAtCursor(line, pos.ch);
      
      if (imageMatch) {
        console.log('🖼️ Image clicked:', imageMatch);
        // Set a timeout to distinguish between single and double clicks
        setTimeout(() => {
          if (!event.detail || event.detail === 1) {
            console.log('👆 Single click detected on image');
            // For single click, just show visual feedback
            addImageClickIndicator(cm, pos.line, imageMatch);
          }
        }, 200);
      }
    });
    
    // Add double-click handler
    codeMirror.on('dblclick', (cm, event) => {
      console.log('👆👆 Double click detected');
      const pos = cm.coordsChar({left: event.clientX, top: event.clientY});
      const line = cm.getLine(pos.line);
      const imageMatch = findImageAtCursor(line, pos.ch);
      
      if (imageMatch) {
        console.log('🖼️ Image double-clicked, opening edit modal:', imageMatch);
        event.preventDefault();
        showImageEditModal(cm, pos.line, imageMatch);
      }
    });
    
    // Also add a more direct click handler to the DOM element
    editor.addEventListener('click', (event) => {
      const cm = editor.CodeMirror;
      if (!cm) return;
      
      const pos = cm.coordsChar({left: event.clientX, top: event.clientY});
      const line = cm.getLine(pos.line);
      const imageMatch = findImageAtCursor(line, pos.ch);
      
      if (imageMatch) {
        console.log('🖱️ Direct DOM click on image detected');
        // Show edit modal on any click within image markdown
        if (event.detail === 2) { // Double click
          event.preventDefault();
          showImageEditModal(cm, pos.line, imageMatch);
        }
      }
    });
  });
  
  // Re-run periodically to catch new editors
  setTimeout(addImageClickHandlers, 4000);
}

function findImageAtCursor(line, cursorPos) {
  // Regex to match markdown images with optional CSS classes
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)(?:\{([^}]+)\})?/g;
  let match;
  
  console.log(`🔍 Searching for images in line: "${line}" at position ${cursorPos}`);
  
  while ((match = imageRegex.exec(line)) !== null) {
    const start = match.index;
    const end = match.index + match[0].length;
    
    console.log(`📍 Found image: "${match[0]}" from ${start} to ${end}`);
    
    if (cursorPos >= start && cursorPos <= end) {
      const imageMatch = {
        fullMatch: match[0],
        alt: match[1],
        url: match[2],
        classes: match[3] || '',
        start: start,
        end: end,
        line: line
      };
      console.log('✅ Cursor is within image bounds:', imageMatch);
      return imageMatch;
    }
  }
  
  console.log('❌ No image found at cursor position');
  return null;
}

function addImageClickIndicator(codeMirror, lineNumber, imageMatch) {
  // Add a subtle highlight to indicate the image is clickable
  const from = { line: lineNumber, ch: imageMatch.start };
  const to = { line: lineNumber, ch: imageMatch.end };
  
  // Clear any existing markers first
  const markers = codeMirror.findMarks(from, to);
  markers.forEach(marker => marker.clear());
  
  // Add a subtle background highlight
  codeMirror.markText(from, to, {
    className: 'clickable-image-highlight',
    title: 'Double-click to edit image properties'
  });
  
  // Add CSS for the highlight if it doesn't exist
  if (!document.querySelector('#image-highlight-style')) {
    const style = document.createElement('style');
    style.id = 'image-highlight-style';
    style.textContent = `
      .clickable-image-highlight {
        background-color: rgba(63, 81, 181, 0.1);
        border-radius: 3px;
        cursor: pointer;
      }
      .clickable-image-highlight:hover {
        background-color: rgba(63, 81, 181, 0.2);
      }
    `;
    document.head.appendChild(style);
  }
}

function showImageEditModal(codeMirror, lineNumber, imageMatch) {
  // Parse existing classes
  const existingClasses = imageMatch.classes.replace(/\./g, '').split(' ').filter(c => c);
  
  // Determine current alignment and size
  let currentAlignment = '';
  let currentSize = '';
  
  existingClasses.forEach(cls => {
    if (['image-left', 'image-right', 'image-center'].includes(cls)) {
      currentAlignment = cls;
    }
    if (['image-small', 'image-medium', 'image-large'].includes(cls)) {
      currentSize = cls;
    }
  });
  
  // Create modal overlay
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.7);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: white;
    padding: 30px;
    border-radius: 8px;
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  `;
  
  modalContent.innerHTML = `
    <h2 style="margin-top: 0; color: #333; font-family: sans-serif;">✏️ Edit Image</h2>
    
    <div style="margin-bottom: 20px;">
      <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">Image URL:</label>
      <input type="text" id="editImageUrl" value="${imageMatch.url}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
    </div>
    
    <div style="margin-bottom: 20px;">
      <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">Alt Text:</label>
      <input type="text" id="editAltText" value="${imageMatch.alt}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
    </div>
    
    <div style="margin-bottom: 20px;">
      <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">Alignment:</label>
      <select id="editAlignment" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
        <option value="" ${!currentAlignment ? 'selected' : ''}>Default (block)</option>
        <option value="image-left" ${currentAlignment === 'image-left' ? 'selected' : ''}>Float Left</option>
        <option value="image-right" ${currentAlignment === 'image-right' ? 'selected' : ''}>Float Right</option>
        <option value="image-center" ${currentAlignment === 'image-center' ? 'selected' : ''}>Center</option>
      </select>
    </div>
    
    <div style="margin-bottom: 20px;">
      <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">Size:</label>
      <select id="editSize" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
        <option value="" ${!currentSize ? 'selected' : ''}>Default</option>
        <option value="image-small" ${currentSize === 'image-small' ? 'selected' : ''}>Small (200px)</option>
        <option value="image-medium" ${currentSize === 'image-medium' ? 'selected' : ''}>Medium (400px)</option>
        <option value="image-large" ${currentSize === 'image-large' ? 'selected' : ''}>Large (600px)</option>
      </select>
    </div>
    
    <div style="margin-bottom: 20px;">
      <h3 style="color: #333; font-size: 16px; margin-bottom: 10px;">Preview:</h3>
      <div id="editPreviewContainer" style="background: #f5f5f5; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 12px; color: #333;">
        ${imageMatch.fullMatch}
      </div>
    </div>
    
    <div style="display: flex; gap: 10px; justify-content: space-between;">
      <button id="deleteImageBtn" style="padding: 10px 20px; border: 1px solid #f44336; background: #f44336; color: white; border-radius: 4px; cursor: pointer;">Delete Image</button>
      <div style="display: flex; gap: 10px;">
        <button id="editCancelBtn" style="padding: 10px 20px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">Cancel</button>
        <button id="updateImageBtn" style="padding: 10px 20px; border: none; background: #3f51b5; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;">Update Image</button>
      </div>
    </div>
  `;
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Set up event listeners
  const editImageUrlInput = modal.querySelector('#editImageUrl');
  const editAltTextInput = modal.querySelector('#editAltText');
  const editAlignmentSelect = modal.querySelector('#editAlignment');
  const editSizeSelect = modal.querySelector('#editSize');
  const editPreviewContainer = modal.querySelector('#editPreviewContainer');
  const editCancelBtn = modal.querySelector('#editCancelBtn');
  const updateImageBtn = modal.querySelector('#updateImageBtn');
  const deleteImageBtn = modal.querySelector('#deleteImageBtn');
  
  // Update preview function
  function updateEditPreview() {
    const url = editImageUrlInput.value || '/images/filename.jpg';
    const alt = editAltTextInput.value || 'Alt text';
    const alignment = editAlignmentSelect.value;
    const size = editSizeSelect.value;
    
    let classes = [];
    if (alignment) classes.push(alignment);
    if (size) classes.push(size);
    
    const classString = classes.length > 0 ? `{.${classes.join(' .')}}` : '';
    const markdown = `![${alt}](${url})${classString}`;
    
    editPreviewContainer.textContent = markdown;
  }
  
  // Set up event listeners for real-time preview
  editImageUrlInput.addEventListener('input', updateEditPreview);
  editAltTextInput.addEventListener('input', updateEditPreview);
  editAlignmentSelect.addEventListener('change', updateEditPreview);
  editSizeSelect.addEventListener('change', updateEditPreview);
  
  // Cancel button
  editCancelBtn.addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  
  // Delete button
  deleteImageBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to delete this image?')) {
      const from = { line: lineNumber, ch: imageMatch.start };
      const to = { line: lineNumber, ch: imageMatch.end };
      codeMirror.replaceRange('', from, to);
      document.body.removeChild(modal);
    }
  });
  
  // Update button
  updateImageBtn.addEventListener('click', () => {
    const url = editImageUrlInput.value.trim();
    const alt = editAltTextInput.value.trim();
    
    if (!url) {
      alert('Please enter an image URL or path');
      return;
    }
    
    if (!alt) {
      alert('Please enter alt text for accessibility');
      return;
    }
    
    const alignment = editAlignmentSelect.value;
    const size = editSizeSelect.value;
    
    let classes = [];
    if (alignment) classes.push(alignment);
    if (size) classes.push(size);
    
    const classString = classes.length > 0 ? `{.${classes.join(' .')}}` : '';
    const newMarkdown = `![${alt}](${url})${classString}`;
    
    // Replace the image in the editor
    const from = { line: lineNumber, ch: imageMatch.start };
    const to = { line: lineNumber, ch: imageMatch.end };
    codeMirror.replaceRange(newMarkdown, from, to);
    
    // Close modal
    document.body.removeChild(modal);
  });
  
  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });
  
  // Focus the URL input
  editImageUrlInput.focus();
}

function enhanceSyncScroll() {
  // Wait for the CMS interface to load
  setTimeout(() => {
    setupSyncScrollEnhancement();
  }, 3000);
}

function setupSyncScrollEnhancement() {
  // Look for editor and preview panes
  const editorPane = document.querySelector('[data-testid="editor-pane"]') || 
                     document.querySelector('.cms-editor-visual-root') ||
                     document.querySelector('.CodeMirror-scroll');
  
  const previewPane = document.querySelector('[data-testid="preview-pane"]') || 
                      document.querySelector('.cms-preview-pane') ||
                      document.querySelector('.cms-editor-preview');
  
  if (editorPane && previewPane) {
    console.log('🔄 Sync scroll enhancement: Editor and preview panes found');
    
    // Check if sync scroll button exists
    const syncButton = document.querySelector('[data-testid="sync-scroll-button"]') ||
                       document.querySelector('.cms-editor-sync-scroll') ||
                       Array.from(document.querySelectorAll('button')).find(btn => 
                         btn.textContent.includes('sync') || btn.title?.includes('sync')
                       );
    
    if (syncButton) {
      console.log('✅ Sync scroll button found and should be working');
      
      // Add visual feedback to sync button
      syncButton.style.transition = 'all 0.2s ease';
      
      // Enhance the sync button with better visual feedback
      const originalBg = getComputedStyle(syncButton).backgroundColor;
      
      syncButton.addEventListener('mouseenter', () => {
        if (!syncButton.classList.contains('active')) {
          syncButton.style.backgroundColor = '#3f51b5';
          syncButton.style.color = 'white';
        }
      });
      
      syncButton.addEventListener('mouseleave', () => {
        if (!syncButton.classList.contains('active')) {
          syncButton.style.backgroundColor = originalBg;
          syncButton.style.color = '';
        }
      });
    } else {
      console.log('⚠️ Sync scroll button not found - may be using different interface');
      
      // Try to create our own sync scroll functionality
      implementCustomSyncScroll(editorPane, previewPane);
    }
  } else {
    console.log('ℹ️ Editor or preview pane not found yet, retrying...');
    // Retry after a delay
    setTimeout(setupSyncScrollEnhancement, 2000);
  }
}

function implementCustomSyncScroll(editorPane, previewPane) {
  console.log('🔧 Implementing custom sync scroll functionality');
  
  let isScrolling = false;
  
  // Add scroll listeners
  editorPane.addEventListener('scroll', () => {
    if (isScrolling) return;
    isScrolling = true;
    
    const scrollPercent = editorPane.scrollTop / (editorPane.scrollHeight - editorPane.clientHeight);
    const targetScrollTop = scrollPercent * (previewPane.scrollHeight - previewPane.clientHeight);
    
    previewPane.scrollTop = targetScrollTop;
    
    setTimeout(() => { isScrolling = false; }, 50);
  });
  
  previewPane.addEventListener('scroll', () => {
    if (isScrolling) return;
    isScrolling = true;
    
    const scrollPercent = previewPane.scrollTop / (previewPane.scrollHeight - previewPane.clientHeight);
    const targetScrollTop = scrollPercent * (editorPane.scrollHeight - editorPane.clientHeight);
    
    editorPane.scrollTop = targetScrollTop;
    
    setTimeout(() => { isScrolling = false; }, 50);
  });
  
  console.log('✅ Custom sync scroll implemented');
}