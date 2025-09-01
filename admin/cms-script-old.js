// This script will run when the CMS is loaded
// It adds some additional functionality to ensure content changes are properly reflected

window.addEventListener('DOMContentLoaded', (event) => {
  console.log('🚀 CMS Script loaded - DOM ready');
  
  // Wait for CMS to be available
  const waitForCMS = () => {
    if (window.CMS) {
      console.log('✅ Decap CMS is available, initializing enhancements...');
      initializeCMSEnhancements();
    } else {
      console.log('⏳ Waiting for Decap CMS to load...');
      setTimeout(waitForCMS, 500);
    }
  };
  
  waitForCMS();
});

function initializeCMSEnhancements() {
  // Initialize CMS
  if (window.CMS) {
    console.log('🎯 Setting up CMS event listeners...');
    
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

    // Setup simple image enhancement buttons
    setTimeout(() => {
      console.log('🔧 Setting up simple image alignment buttons...');
      setupImageAlignmentButtons();
    }, 2000);
  }
}

function setupImageAlignmentButtons() {
  // Wait for the editor to be ready
  setTimeout(() => {
    addImageAlignmentButtons();
  }, 2000);
}

function addImageAlignmentButtons() {
  console.log('🖼️ Adding image alignment buttons...');
  
  // Remove any existing buttons
  const existingButtons = document.querySelectorAll('.image-alignment-toolbar');
  existingButtons.forEach(btn => btn.remove());
  
  // Create a simple toolbar for image alignment
  const toolbar = document.createElement('div');
  toolbar.className = 'image-alignment-toolbar';
  toolbar.style.cssText = `
    position: fixed;
    top: 60px;
    right: 20px;
    z-index: 10001;
    background: white;
    border: 2px solid #3f51b5;
    border-radius: 8px;
    padding: 10px;
    box-shadow: 0 4px 12px rgba(63, 81, 181, 0.3);
    display: flex;
    gap: 8px;
    flex-direction: column;
  `;
  
  toolbar.innerHTML = `
    <div style="font-size: 12px; font-weight: bold; color: #3f51b5; text-align: center; margin-bottom: 5px;">
      🖼️ Image Tools
    </div>
    <button class="img-btn" data-action="left" style="background: #2196F3; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">
      ← Float Left
    </button>
    <button class="img-btn" data-action="right" style="background: #FF9800; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">
      Float Right →
    </button>
    <button class="img-btn" data-action="center" style="background: #4CAF50; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">
      📍 Center
    </button>
    <button class="img-btn" data-action="small" style="background: #9C27B0; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">
      🔸 Small
    </button>
    <button class="img-btn" data-action="medium" style="background: #E91E63; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">
      🔹 Medium
    </button>
    <button class="img-btn" data-action="large" style="background: #795548; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">
      🔶 Large
    </button>
  `;
  
  // Add click handlers
  toolbar.querySelectorAll('.img-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const action = btn.dataset.action;
      console.log(`🎯 Image ${action} button clicked`);
      applyImageAlignment(action);
    });
    
    // Add hover effects
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.05)';
      btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    });
    
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = 'none';
    });
  });
  
  document.body.appendChild(toolbar);
  console.log('✅ Added image alignment toolbar');
  
  // Re-run periodically to ensure it stays available
  setTimeout(addImageAlignmentButtons, 5000);
}

function applyImageAlignment(action) {
  console.log(`🔧 Applying image alignment: ${action}`);
  
  // Find the active editor
  const editor = findActiveEditor();
  if (!editor) {
    alert('Please click in the editor first, then select some text containing an image before using image alignment tools.');
    return;
  }
  
  let success = false;
  
  // Try CodeMirror first
  if (editor.CodeMirror) {
    success = applyAlignmentToCodeMirror(editor.CodeMirror, action);
  } else {
    // Try textarea fallback
    const textarea = editor.querySelector('textarea') || document.querySelector('textarea');
    if (textarea) {
      success = applyAlignmentToTextarea(textarea, action);
    }
  }
  
  if (success) {
    showAlignmentSuccess(action);
  } else {
    alert(`❌ No image found at cursor position. Please:\n1. Select text containing an image\n2. Or place cursor on an image line\n3. Then try the ${action} alignment again.`);
  }
}

function findActiveEditor() {
  // Look for CodeMirror editors
  const codeMirrorEditors = document.querySelectorAll('.CodeMirror');
  for (let editor of codeMirrorEditors) {
    if (editor.CodeMirror && editor.CodeMirror.hasFocus && editor.CodeMirror.hasFocus()) {
      return editor;
    }
  }
  
  // Fallback: find any CodeMirror
  if (codeMirrorEditors.length > 0) {
    return codeMirrorEditors[0];
  }
  
  // Fallback: find focused textarea
  const textareas = document.querySelectorAll('textarea');
  for (let textarea of textareas) {
    if (document.activeElement === textarea) {
      return textarea;
    }
  }
  
  // Last resort: any textarea
  return textareas[0] || null;
}

function applyAlignmentToCodeMirror(cm, action) {
  const cursor = cm.getCursor();
  const selection = cm.getSelection();
  
  // If there's a selection, work with that
  if (selection.trim()) {
    return processImageText(selection, action, (newText) => {
      cm.replaceSelection(newText);
      return true;
    });
  }
  
  // Otherwise, work with the current line
  const line = cm.getLine(cursor.line);
  return processImageText(line, action, (newText) => {
    cm.setLine(cursor.line, newText);
    return true;
  });
}

function applyAlignmentToTextarea(textarea, action) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = textarea.value.substring(start, end);
  
  // If there's a selection, work with that
  if (selectedText.trim()) {
    return processImageText(selectedText, action, (newText) => {
      textarea.value = textarea.value.substring(0, start) + newText + textarea.value.substring(end);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    });
  }
  
  // Otherwise, work with the current line
  const lines = textarea.value.split('\n');
  const currentLineIndex = textarea.value.substring(0, start).split('\n').length - 1;
  const currentLine = lines[currentLineIndex];
  
  return processImageText(currentLine, action, (newText) => {
    lines[currentLineIndex] = newText;
    textarea.value = lines.join('\n');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  });
}

function processImageText(text, action, updateCallback) {
  // Regex to match markdown images with optional CSS classes
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)(?:\{([^}]*)\})?/g;
  let hasImages = false;
  
  const newText = text.replace(imageRegex, (match, alt, url, existingClasses) => {
    hasImages = true;
    console.log(`🖼️ Found image: ${match}`);
    
    // Parse existing classes
    let classes = [];
    if (existingClasses) {
      classes = existingClasses.split(/[\s.]+/).filter(c => c && c !== '');
    }
    
    // Remove existing alignment and size classes
    classes = classes.filter(c => !c.match(/^image-(left|right|center|small|medium|large)$/));
    
    // Add new class based on action
    const classMap = {
      'left': 'image-left',
      'right': 'image-right', 
      'center': 'image-center',
      'small': 'image-small',
      'medium': 'image-medium',
      'large': 'image-large'
    };
    
    if (classMap[action]) {
      classes.push(classMap[action]);
    }
    
    // Build the new image markdown
    const classString = classes.length > 0 ? `{.${classes.join(' .')}}` : '';
    const newImage = `![${alt}](${url})${classString}`;
    
    console.log(`✅ Updated image: ${newImage}`);
    return newImage;
  });
  
  if (hasImages) {
    return updateCallback(newText);
  }
  
  return false;
}

function showAlignmentSuccess(action) {
  // Create success notification
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #4CAF50;
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10002;
    font-family: sans-serif;
    font-size: 14px;
    font-weight: bold;
  `;
  
  const actionNames = {
    'left': '← Float Left',
    'right': 'Float Right →',
    'center': '📍 Center',
    'small': '🔸 Small Size',
    'medium': '🔹 Medium Size',
    'large': '🔶 Large Size'
  };
  
  notification.textContent = `✅ Applied ${actionNames[action]} to image(s)`;
  
  document.body.appendChild(notification);
  
  // Auto-remove after 2 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 2000);
}

function setupImageInsertionHelper() {
  // Wait for the editor to be ready
  setTimeout(() => {
    addFloatingImageButton();
  }, 2000);
}

function addFloatingImageButton() {
  console.log('🖼️ Adding floating image insertion button...');
  
  // Remove any existing floating button
  const existingButton = document.querySelector('.floating-enhanced-image-button');
  if (existingButton) {
    existingButton.remove();
  }
  
  // Create a single, clean floating button
  const floatingButton = document.createElement('button');
  floatingButton.className = 'floating-enhanced-image-button';
  floatingButton.innerHTML = '🖼️ Enhanced Image Insert';
  floatingButton.title = 'Insert image with alignment and sizing options';
  floatingButton.style.cssText = `
    position: fixed;
    top: 100px;
    right: 20px;
    z-index: 10001;
    background: linear-gradient(135deg, #3f51b5, #5c6bc0);
    color: white;
    border: none;
    padding: 12px 20px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
    box-shadow: 0 4px 12px rgba(63, 81, 181, 0.3);
    transition: all 0.2s ease;
  `;
  
  floatingButton.addEventListener('click', (e) => {
    e.preventDefault();
    console.log('🎯 Floating enhanced image button clicked');
    
    // Find any available editor
    const editor = document.querySelector('.CodeMirror') ||
                  document.querySelector('textarea') ||
                  document.querySelector('[contenteditable]');
    
    if (editor) {
      showImageInsertionModal(editor);
    } else {
      alert('Please open an entry for editing first, then use this button to insert images.');
    }
  });
  
  // Add hover effects
  floatingButton.addEventListener('mouseenter', () => {
    floatingButton.style.transform = 'translateY(-2px)';
    floatingButton.style.boxShadow = '0 6px 16px rgba(63, 81, 181, 0.4)';
  });
  
  floatingButton.addEventListener('mouseleave', () => {
    floatingButton.style.transform = 'translateY(0)';
    floatingButton.style.boxShadow = '0 4px 12px rgba(63, 81, 181, 0.3)';
  });
  
  document.body.appendChild(floatingButton);
  console.log('✅ Added clean floating enhanced image button');
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
  
  // First try the standard approach
  const markdownEditors = document.querySelectorAll(
    '[data-testid="richtext"] .CodeMirror, .CodeMirror, ' +
    '.nc-controlPane-widget .CodeMirror, ' +
    '.cms-editor-visual .CodeMirror, ' +
    'div[data-testid="markdown"] .CodeMirror'
  );
  
  console.log(`📝 Found ${markdownEditors.length} CodeMirror editors`);
  
  // Also try to find editors without CodeMirror
  const textAreas = document.querySelectorAll(
    'textarea[data-testid="markdown"], ' +
    '.nc-controlPane-widget textarea, ' +
    '.cms-editor-visual textarea'
  );
  
  console.log(`📝 Found ${textAreas.length} textareas`);
  
  // New approach: Look for any container that might hold an editor
  const possibleEditorContainers = document.querySelectorAll(
    '.nc-controlPane-widget, ' +
    '[data-testid="richtext"], ' +
    '.cms-editor-visual, ' +
    'div[class*="editor"], ' +
    'div[class*="markdown"], ' +
    'div[class*="widget"]'
  );
  
  console.log(`📦 Found ${possibleEditorContainers.length} possible editor containers`);
  
  const allTargets = [...markdownEditors, ...textAreas, ...possibleEditorContainers];
  
  allTargets.forEach((target, index) => {
    if (target.dataset.imageHelperAdded) {
      console.log(`⏭️ Target ${index} already has image helper`);
      return;
    }
    target.dataset.imageHelperAdded = 'true';
    
    console.log(`➕ Adding image insertion button to target ${index}`, target);
    
    // Create image insertion button
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'enhanced-image-button-container';
    buttonContainer.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 10000 !important;
      background: #fff;
      border: 2px solid #3f51b5;
      border-radius: 6px;
      padding: 3px;
      box-shadow: 0 4px 12px rgba(63, 81, 181, 0.3);
    `;
    
    const imageButton = document.createElement('button');
    imageButton.innerHTML = '🖼️ Enhanced Image Insert';
    imageButton.type = 'button';
    imageButton.title = 'Insert image with alignment and sizing options';
    imageButton.className = 'enhanced-image-button';
    imageButton.style.cssText = `
      background: linear-gradient(135deg, #3f51b5, #5c6bc0);
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-weight: bold;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      transition: all 0.2s ease;
    `;
    
    imageButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('🎯 Enhanced image button clicked, opening modal...');
      
      // Find the best editor target
      const editor = target.querySelector('.CodeMirror') || 
                    target.querySelector('textarea') ||
                    target.querySelector('[contenteditable]') ||
                    target;
      
      showImageInsertionModal(editor);
    });
    
    // Add hover effects
    imageButton.addEventListener('mouseenter', () => {
      imageButton.style.transform = 'translateY(-1px)';
      imageButton.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
    });
    
    imageButton.addEventListener('mouseleave', () => {
      imageButton.style.transform = 'translateY(0)';
      imageButton.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
    });
    
    buttonContainer.appendChild(imageButton);
    
    // Try multiple approaches to add the button
    target.style.position = 'relative';
    target.appendChild(buttonContainer);
    
    console.log(`✅ Successfully added image button to target ${index}`);
  });
  
  // If we didn't find any suitable targets, try a fallback approach
  if (allTargets.length === 0) {
    console.log('🚨 No suitable targets found, trying fallback approach...');
    
    // Add button to the body as a floating button
    const existingFloatingButton = document.querySelector('.floating-enhanced-image-button');
    if (!existingFloatingButton) {
      const floatingButton = document.createElement('button');
      floatingButton.className = 'floating-enhanced-image-button';
      floatingButton.innerHTML = '🖼️ Enhanced Image Insert';
      floatingButton.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        z-index: 10001;
        background: linear-gradient(135deg, #3f51b5, #5c6bc0);
        color: white;
        border: none;
        padding: 12px 20px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: bold;
        box-shadow: 0 4px 12px rgba(63, 81, 181, 0.3);
        transition: all 0.2s ease;
      `;
      
      floatingButton.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('🎯 Floating enhanced image button clicked');
        
        // Find any available editor
        const editor = document.querySelector('.CodeMirror') ||
                      document.querySelector('textarea') ||
                      document.querySelector('[contenteditable]');
        
        if (editor) {
          showImageInsertionModal(editor);
        } else {
          alert('Please open an entry for editing first, then use this button to insert images.');
        }
      });
      
      document.body.appendChild(floatingButton);
      console.log('✅ Added floating enhanced image button');
    }
  }
  
  // Re-run periodically to catch new editors
  setTimeout(addImageInsertionButton, 3000);
  
  // Show helpful notification about enhanced image insertion
  setTimeout(showImageInsertionNotification, 5000);
}

function overrideDefaultImageInsertion() {
  console.log('🔧 Setting up default image insertion override...');
  
  // Override any existing image buttons with our enhanced workflow
  const checkAndOverride = () => {
    // Get ALL buttons on the page
    const allButtons = document.querySelectorAll('button');
    console.log(`🔍 Scanning ${allButtons.length} buttons for image functionality...`);
    
    allButtons.forEach((button, index) => {
      if (button.dataset.overridden === 'true') return;
      
      // Check if this is likely an image insertion button
      const buttonText = button.textContent?.toLowerCase() || '';
      const buttonTitle = button.title?.toLowerCase() || '';
      const buttonClass = button.className?.toLowerCase() || '';
      const buttonAriaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
      const buttonHTML = button.innerHTML.toLowerCase();
      
      // More aggressive detection - look for any SVG with path elements (common for icons)
      const hasSVG = buttonHTML.includes('<svg') && buttonHTML.includes('<path');
      const hasImageKeywords = 
        buttonText.includes('image') || 
        buttonTitle.includes('image') || 
        buttonClass.includes('image') || 
        buttonAriaLabel.includes('image');
      
      // Check if this might be a toolbar button (common location for image buttons)
      const isToolbarButton = 
        buttonClass.includes('toolbar') ||
        buttonClass.includes('nc-') ||
        button.closest('.toolbar') ||
        button.closest('[class*="toolbar"]') ||
        button.closest('[class*="nc-"]');
      
      // If it has an SVG and is in a toolbar-like context, it might be an image button
      const mightBeImageButton = hasImageKeywords || (hasSVG && isToolbarButton);
      
      if (mightBeImageButton) {
        console.log(`🎯 Potentially overriding button ${index}:`, {
          text: buttonText.substring(0, 30),
          title: buttonTitle,
          class: buttonClass.substring(0, 50),
          hasSVG: hasSVG,
          isToolbarButton: isToolbarButton,
          element: button
        });
        
        button.dataset.overridden = 'true';
        
        // Create a wrapper to intercept clicks
        const originalClick = button.onclick;
        const originalListeners = button.cloneNode(true);
        
        // Override ALL click events
        button.addEventListener('click', (e) => {
          // Check if this might actually be an image button by looking at the context
          const isLikelyImageButton = 
            hasImageKeywords || 
            (hasSVG && (isToolbarButton || button.closest('.editor')));
          
          if (isLikelyImageButton) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            console.log('🚫 Intercepted potential image button click, opening enhanced modal');
            
            // Find any available editor
            const editor = findNearestEditor(button) || 
                          document.querySelector('.CodeMirror') ||
                          document.querySelector('textarea') ||
                          document.querySelector('[contenteditable]');
            
            if (editor) {
              showImageInsertionModal(editor);
            } else {
              console.error('❌ No editor found');
              alert('Enhanced image insertion available! Please look for the "🖼️ Enhanced Image Insert" button in the editor.');
            }
            
            return false;
          }
        }, { capture: true, passive: false });
        
        // Visual enhancement to make it clear this is enhanced
        if (!button.querySelector('.enhanced-indicator')) {
          const indicator = document.createElement('span');
          indicator.className = 'enhanced-indicator';
          indicator.textContent = '✨';
          indicator.style.cssText = `
            position: absolute;
            top: -3px;
            right: -3px;
            font-size: 8px;
            background: #3f51b5;
            color: white;
            border-radius: 50%;
            width: 14px;
            height: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            pointer-events: none;
          `;
          button.style.position = 'relative';
          button.appendChild(indicator);
        }
      }
    });
  };
  
  // Run immediately and very frequently to catch dynamic content
  checkAndOverride();
  setInterval(checkAndOverride, 1000);
}

function findNearestEditor(button) {
  console.log('🔍 Finding nearest editor for button:', button);
  
  // Try to find the closest CodeMirror editor
  let element = button;
  while (element && element !== document.body) {
    // Look for CodeMirror in current element
    const codeMirror = element.querySelector('.CodeMirror');
    if (codeMirror) {
      console.log('✅ Found CodeMirror editor');
      return codeMirror;
    }
    
    // Check if current element is CodeMirror
    if (element.classList?.contains('CodeMirror')) {
      console.log('✅ Current element is CodeMirror editor');
      return element;
    }
    
    element = element.parentElement;
  }
  
  // Fallback: find any CodeMirror editor on the page
  const allEditors = document.querySelectorAll('.CodeMirror');
  if (allEditors.length > 0) {
    console.log('⚠️ Using fallback: first available editor');
    return allEditors[0];
  }
  
  console.log('❌ No CodeMirror editor found');
  return null;
}

function showImageInsertionNotification() {
  // Only show if we haven't shown it before in this session
  if (sessionStorage.getItem('imageNotificationShown')) return;
  
  console.log('💡 Showing image insertion notification...');
  
  // Create notification
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #3f51b5, #5c6bc0);
    color: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    z-index: 10001;
    max-width: 350px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    animation: slideIn 0.3s ease-out;
  `;
  
  notification.innerHTML = `
    <div style="display: flex; align-items: flex-start; gap: 10px;">
      <span style="font-size: 24px;">🖼️</span>
      <div>
        <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold;">Enhanced Image Insertion Available!</h3>
        <p style="margin: 0 0 10px 0; font-size: 14px; line-height: 1.4; opacity: 0.9;">
          Look for the <strong>"🖼️ Enhanced Image Insert"</strong> button in the top-right corner of editors for advanced image options.
        </p>
        <button onclick="this.parentElement.parentElement.parentElement.remove(); sessionStorage.setItem('imageNotificationShown', 'true');" 
                style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">
          Got it!
        </button>
      </div>
    </div>
  `;
  
  // Add animation styles
  if (!document.querySelector('#notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(notification);
  
  // Auto-dismiss after 8 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => {
        if (notification.parentElement) {
          notification.remove();
          sessionStorage.setItem('imageNotificationShown', 'true');
        }
      }, 300);
    }
  }, 8000);
}

// Add a simple debug indicator that the script is loaded
function addDebugIndicator() {
  const indicator = document.createElement('div');
  indicator.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    background: #4CAF50;
    color: white;
    padding: 10px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 10000;
    font-family: monospace;
  `;
  indicator.textContent = '✅ Enhanced Image Insertion Ready';
  document.body.appendChild(indicator);
  
  // Remove after 3 seconds
  setTimeout(() => {
    if (indicator.parentElement) {
      indicator.remove();
    }
  }, 3000);
}

// Call debug indicator when script loads
setTimeout(addDebugIndicator, 1000);

// Show notification about the floating button
setTimeout(() => {
  showImageInsertionNotification();
}, 5000);

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
    
    <div style="display: grid; grid-template-columns: 1fr auto; gap: 10px; margin-bottom: 20px;">
      <div>
        <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">Image URL or Path:</label>
        <input type="text" id="imageUrl" placeholder="/images/filename.jpg" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
        <small style="color: #666; font-size: 12px;">Upload images first via the media library, then reference them here</small>
      </div>
      <div style="display: flex; align-items: end;">
        <button type="button" id="browseMediaBtn" style="background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 12px; white-space: nowrap;">
          📁 Browse Media
        </button>
      </div>
    </div>
    
    <div style="margin-bottom: 20px;">
      <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">Alt Text (Required):</label>
      <input type="text" id="altText" placeholder="Describe the image for accessibility" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
      <small style="color: #666; font-size: 12px;">Describes the image for screen readers and SEO</small>
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
  const browseMediaBtn = modal.querySelector('#browseMediaBtn');
  
  // Direct media library integration - KISS approach
  browseMediaBtn.addEventListener('click', () => {
    console.log('📁 Browse media button clicked - opening media library directly');
    
    // Step 1: Find and click the CMS media library button
    const findAndClickMediaButton = () => {
      // Look for ANY button that might open media library
      const allButtons = document.querySelectorAll('button');
      
      for (let btn of allButtons) {
        const btnText = btn.textContent?.toLowerCase() || '';
        const btnHTML = btn.innerHTML.toLowerCase();
        const btnTitle = btn.title?.toLowerCase() || '';
        const btnAriaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
        
        // Check if this looks like a media/file/image button
        const isMediaButton = 
          btnText.includes('choose') || btnText.includes('browse') || btnText.includes('select') ||
          btnTitle.includes('choose') || btnTitle.includes('browse') || btnTitle.includes('select') ||
          btnAriaLabel.includes('choose') || btnAriaLabel.includes('browse') || btnAriaLabel.includes('select') ||
          btnHTML.includes('folder') || btnHTML.includes('upload') || btnHTML.includes('file') ||
          btn.className.includes('media') || btn.className.includes('file');
        
        if (isMediaButton) {
          console.log('🎯 Found potential media button:', btn);
          
          // Setup the path copier BEFORE clicking
          setupSimplePathCopier(imageUrlInput);
          
          // Click the button
          btn.click();
          return true;
        }
      }
      return false;
    };
    
    // Try to find and click media button
    if (!findAndClickMediaButton()) {
      // Fallback: Show simple instructions
      alert('📁 Media Library:\n\n1. Look for "Choose image" or "Browse" button in the CMS\n2. Click it to open media library\n3. Select your image\n4. The path will auto-copy to this modal!\n\nThen just set your alignment and size options.');
    }
  });

// Setup observer to detect media library interactions
function setupMediaLibraryObserver(originalModal, imageUrlInput, mediaHelper) {
  console.log('👁️ Setting up media library observer...');
  
  let checkCount = 0;
  const maxChecks = 50; // Check for 25 seconds
  
  const checkForMediaSelection = () => {
    checkCount++;
    
    // Look for media library elements that might indicate a selection
    const mediaLibrary = document.querySelector('.cms-media-library') || 
                         document.querySelector('[class*="media"]') ||
                         document.querySelector('[data-testid*="media"]');
    
    if (mediaLibrary) {
      console.log('📁 Media library detected, watching for selections...');
      
      // Watch for clicks on media items
      const mediaItems = mediaLibrary.querySelectorAll('img, [class*="media-item"], [data-testid*="media-item"]');
      
      mediaItems.forEach(item => {
        item.addEventListener('click', (e) => {
          console.log('🖼️ Media item clicked:', item);
          
          // Try to extract image path from various sources
          let imagePath = null;
          
          if (item.tagName === 'IMG') {
            imagePath = item.src || item.getAttribute('data-src');
          } else {
            const img = item.querySelector('img');
            if (img) {
              imagePath = img.src || img.getAttribute('data-src');
            }
          }
          
          // Convert absolute URL to relative path if needed
          if (imagePath) {
            try {
              const url = new URL(imagePath);
              imagePath = url.pathname; // Convert to relative path
            } catch (e) {
              // Already a relative path, keep as is
            }
            
            console.log('📋 Extracted image path:', imagePath);
            
            // Wait a bit for the media library to process the selection
            setTimeout(() => {
              // Auto-fill the path in our enhanced modal
              imageUrlInput.value = imagePath;
              imageUrlInput.dispatchEvent(new Event('input', { bubbles: true }));
              
              // Clean up helper overlay
              if (mediaHelper && mediaHelper.parentElement) {
                document.body.removeChild(mediaHelper);
              }
              
              // Show success message
              showMediaSelectionSuccess(imagePath);
            }, 500);
          }
        });
      });
    }
    
    // Continue checking if we haven't reached max checks
    if (checkCount < maxChecks) {
      setTimeout(checkForMediaSelection, 500);
    } else {
      // Cleanup after timeout
      if (mediaHelper && mediaHelper.parentElement) {
        document.body.removeChild(mediaHelper);
      }
      console.log('⏰ Media library observer timeout');
    }
  };
  
  // Start checking after a short delay
  setTimeout(checkForMediaSelection, 1000);
}

function showMediaSelectionSuccess(imagePath) {
  // Create success notification
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #28a745;
    color: white;
    padding: 15px 20px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10002;
    font-family: sans-serif;
    font-size: 14px;
    max-width: 400px;
  `;
  
  notification.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px;">
      <span style="font-size: 18px;">✅</span>
      <div>
        <strong>Image Selected!</strong><br>
        <small style="opacity: 0.9;">Path auto-copied: ${imagePath}</small>
      </div>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 3000);
}

function showMediaLibraryInstructions() {
  alert(`📁 Media Library Access

I couldn't find the media library button automatically. Here's how to use it:

OPTION 1 - Manual Integration:
1. Look for a "Choose image" or "Browse" button in the CMS interface
2. Click it to open the media library
3. Upload or select your image
4. Copy the image path (e.g., /images/filename.jpg)
5. Return to this enhanced modal and paste the path

OPTION 2 - Quick Upload:
1. Close this modal temporarily  
2. Use the regular CMS image insertion to upload
3. Copy the markdown that gets inserted
4. Delete that insertion and reopen this enhanced modal
5. Paste just the path part into the URL field

This workflow gives you both upload capability and enhanced formatting options!`);
}
  
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
  console.log('🎯 Editor element received:', editor);
  
  // Method 1: Try CodeMirror first (most common in Decap CMS)
  let codeMirror;
  
  // Direct CodeMirror instance
  if (editor && editor.CodeMirror) {
    codeMirror = editor.CodeMirror;
    console.log('✅ Found direct CodeMirror instance');
  } 
  // Look for CodeMirror in element hierarchy
  else if (editor) {
    const cmElement = editor.closest('.CodeMirror') || editor.querySelector('.CodeMirror');
    if (cmElement && cmElement.CodeMirror) {
      codeMirror = cmElement.CodeMirror;
      console.log('✅ Found CodeMirror instance in hierarchy');
    }
  }
  
  // Try to find ANY CodeMirror on page as fallback
  if (!codeMirror) {
    const allCM = document.querySelectorAll('.CodeMirror');
    for (let cm of allCM) {
      if (cm.CodeMirror) {
        codeMirror = cm.CodeMirror;
        console.log('✅ Found CodeMirror instance as fallback');
        break;
      }
    }
  }
  
  if (codeMirror) {
    try {
      const cursor = codeMirror.getCursor();
      console.log('📍 Current cursor position:', cursor);
      
      // Get current line content to determine spacing
      const currentLine = codeMirror.getLine(cursor.line) || '';
      const lineIsEmpty = currentLine.trim().length === 0;
      const atLineStart = cursor.ch === 0;
      
      // Smart spacing: add appropriate newlines
      let textToInsert = text;
      if (!lineIsEmpty && !atLineStart) {
        // Middle or end of non-empty line
        textToInsert = '\n\n' + text + '\n\n';
      } else if (!lineIsEmpty && atLineStart) {
        // Start of non-empty line
        textToInsert = text + '\n\n';
      } else {
        // Empty line
        textToInsert = text + '\n\n';
      }
      
      codeMirror.replaceRange(textToInsert, cursor);
      
      // Position cursor after inserted text
      const newCursor = { 
        line: cursor.line + textToInsert.split('\n').length - 1, 
        ch: textToInsert.split('\n').pop().length 
      };
      codeMirror.setCursor(newCursor);
      codeMirror.focus();
      
      console.log('✅ Successfully inserted text via CodeMirror');
      return true;
    } catch (error) {
      console.error('❌ Error inserting text via CodeMirror:', error);
    }
  }
  
  // Method 2: Fallback to textarea approach
  console.log('⚠️ CodeMirror not found, trying textarea fallback...');
  
  // Find textarea in various ways
  const textareas = [
    editor?.querySelector('textarea'),
    document.querySelector('textarea[data-testid="markdown"]'),
    document.querySelector('textarea[class*="editor"]'),
    document.querySelector('textarea[class*="cms"]'),
    ...document.querySelectorAll('textarea')
  ].filter(Boolean);
  
  for (let textarea of textareas) {
    if (!textarea) continue;
    
    try {
      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      const value = textarea.value || '';
      
      console.log('📝 Textarea state:', { start, end, valueLength: value.length });
      
      // Smart spacing for textarea
      let textToInsert = text;
      if (start > 0 && value[start - 1] !== '\n') {
        textToInsert = '\n\n' + text + '\n\n';
      } else {
        textToInsert = text + '\n\n';
      }
      
      // Insert text
      const newValue = value.substring(0, start) + textToInsert + value.substring(end);
      textarea.value = newValue;
      
      // Position cursor after inserted text
      const newCursorPos = start + textToInsert.length;
      textarea.selectionStart = textarea.selectionEnd = newCursorPos;
      textarea.focus();
      
      // Trigger all relevant events to ensure CMS detects the change
      ['input', 'change', 'keyup', 'paste'].forEach(eventType => {
        textarea.dispatchEvent(new Event(eventType, { bubbles: true }));
      });
      
      // Also try triggering React-style events
      const nativeInputValue = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
      if (nativeInputValue && nativeInputValue.set) {
        nativeInputValue.set.call(textarea, newValue);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
      
      console.log('✅ Successfully inserted text via textarea fallback');
      return true;
    } catch (error) {
      console.error('❌ Error with textarea:', error);
      continue;
    }
  }
  
  // Method 3: Last resort - try contenteditable
  console.log('⚠️ Trying contenteditable fallback...');
  const editableElements = document.querySelectorAll('[contenteditable="true"]');
  
  for (let editable of editableElements) {
    try {
      // Insert at current selection
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        
        const textNode = document.createTextNode('\n\n' + text + '\n\n');
        range.insertNode(textNode);
        
        // Move cursor after inserted text
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
        
        editable.focus();
        
        // Trigger change events
        editable.dispatchEvent(new Event('input', { bubbles: true }));
        
        console.log('✅ Successfully inserted text via contenteditable fallback');
        return true;
      }
    } catch (error) {
      console.error('❌ Error with contenteditable:', error);
      continue;
    }
  }
  
  console.error('❌ All insertion methods failed');
  console.log('🔍 Available elements on page:');
  console.log('CodeMirror elements:', document.querySelectorAll('.CodeMirror').length);
  console.log('Textarea elements:', document.querySelectorAll('textarea').length);
  console.log('Contenteditable elements:', document.querySelectorAll('[contenteditable]').length);
  
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