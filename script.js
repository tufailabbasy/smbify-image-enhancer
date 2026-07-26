// STATE MANAGEMENT
const state = {
  mode: 'single', // 'single' | 'bulk'
  single: {
    file: null,
    img: null,
    originalWidth: 0,
    originalHeight: 0,
    currentWidth: 0,
    currentHeight: 0,
    rotation: 0, // 0, 90, 180, 270
    flipH: false,
    flipV: false,
    history: [],
    historyIndex: -1,
    zoom: 1
  },
  bulk: {
    queue: [] // Array of { id, file, name, sizeText, status: 'pending'|'processing'|'success' }
  },
  crop: {
    active: false,
    ratio: 'free',
    startX: 0,
    startY: 0,
    startW: 0,
    startH: 0,
    boxX: 0,
    boxY: 0,
    boxW: 0,
    boxH: 0,
    handle: null
  }
};

// CAMERA PRESETS (USA STANDARD)
const CAMERA_PRESETS = {
  iphone14: { make: 'Apple', model: 'iPhone 14 Pro', software: 'iOS 16.3' },
  iphone13: { make: 'Apple', model: 'iPhone 13 Pro', software: 'iOS 15.4' },
  iphone15: { make: 'Apple', model: 'iPhone 15 Pro Max', software: 'iOS 17.1' },
  samsung23: { make: 'Samsung', model: 'SM-S918U', software: 'Android 13' }, // S23 Ultra US version
  samsung24: { make: 'Samsung', model: 'SM-S928U', software: 'Android 14' }, // S24 Ultra US version
  pixel8: { make: 'Google', model: 'Pixel 8 Pro', software: 'Android 14' },
  canonr6: { make: 'Canon', model: 'EOS R6 Mark II', software: 'Firmware v1.1.0' },
  sony7: { make: 'Sony', model: 'ILCE-7M4', software: 'v2.00' }
};

// GPS PRESETS (USA CITIES)
const GPS_PRESETS = {
  nyc: { lat: 40.7128, lng: -74.0060 },
  la: { lat: 34.0522, lng: -118.2437 },
  chicago: { lat: 41.8781, lng: -87.6298 },
  houston: { lat: 29.7604, lng: -95.3698 },
  miami: { lat: 25.7617, lng: -80.1918 },
  sf: { lat: 37.7749, lng: -122.4194 }
};

// FILTER DEFAULT STATE
const DEFAULT_FILTERS = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  exposure: 100,
  sharpness: 0,
  blur: 0,
  sepia: 0,
  grayscale: 0,
  hueRotate: 0,
  invert: 0
};

let currentFilters = { ...DEFAULT_FILTERS };

// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
  setupAccordion();
  setupSliders();
  setupPresets();
  setupModeSwitching();
  setupFileUpload();
  setupToolbar();
  setupResizeMode();
  setupEXIFControls();
  setupFilenameControls();
  setupExport();
  loadSampleImage();
  initCropperEvents();
  setupUndoRedo();
});

// ACCORDION
function setupAccordion() {
  document.querySelectorAll('.settings-card .card-header').forEach(header => {
    header.addEventListener('click', () => {
      const card = header.parentElement;
      
      // Close other cards
      document.querySelectorAll('.settings-card').forEach(c => {
        if (c !== card && !c.classList.contains('collapsed-header')) {
          c.classList.add('collapsed-header');
          c.classList.remove('active-border');
        }
      });
      
      // Toggle current card
      card.classList.toggle('collapsed-header');
      card.classList.toggle('active-border');
    });
  });
  
  // Expand first card by default
  const firstCard = document.querySelector('.settings-card');
  if (firstCard) {
    firstCard.classList.remove('collapsed-header');
    firstCard.classList.add('active-border');
  }
}

// SLIDERS & REALTIME CSS PREVIEW
function setupSliders() {
  const updateFilterPreview = () => {
    const preview = document.getElementById('preview-image');
    if (!preview) return;
    
    const f = currentFilters;
    // CSS equivalent filter string (exposure represented by brightness/contrast matrix or direct brightness)
    const brightnessVal = (f.brightness * (f.exposure / 100)).toFixed(1);
    
    preview.style.filter = `
      brightness(${brightnessVal}%) 
      contrast(${f.contrast}%) 
      saturate(${f.saturation}%) 
      grayscale(${f.grayscale}%) 
      sepia(${f.sepia}%) 
      hue-rotate(${f.hueRotate}deg) 
      invert(${f.invert}%) 
      blur(${f.blur}px)
    `;
  };

  const sliders = [
    { id: 'brightness', unit: '%' },
    { id: 'contrast', unit: '%' },
    { id: 'saturation', unit: '%' },
    { id: 'exposure', unit: '%' },
    { id: 'sharpness', unit: 'px' },
    { id: 'blur', unit: 'px' },
    { id: 'sepia', unit: '%' },
    { id: 'grayscale', unit: '%' },
    { id: 'hue-rotate', unit: '°', key: 'hueRotate' },
    { id: 'invert', unit: '%' }
  ];

  sliders.forEach(s => {
    const slider = document.getElementById(`slider-${s.id}`);
    const display = document.getElementById(`val-${s.id}`);
    const key = s.key || s.id;

    if (slider && display) {
      slider.addEventListener('input', (e) => {
        const val = e.target.value;
        display.textContent = `${val}${s.unit}`;
        currentFilters[key] = parseFloat(val);
        updateFilterPreview();
        
        // Remove active class from preset buttons on manual slider change
        document.querySelectorAll('.preset-filter-btn').forEach(b => b.classList.remove('active'));
      });
    }
  });

  // Reset sliders
  document.getElementById('btn-reset-filters').addEventListener('click', () => {
    currentFilters = { ...DEFAULT_FILTERS };
    sliders.forEach(s => {
      const slider = document.getElementById(`slider-${s.id}`);
      const display = document.getElementById(`val-${s.id}`);
      const key = s.key || s.id;
      if (slider && display) {
        slider.value = DEFAULT_FILTERS[key];
        display.textContent = `${DEFAULT_FILTERS[key]}${s.unit}`;
      }
    });
    
    // Reset active preset state
    document.querySelectorAll('.preset-filter-btn').forEach(b => b.classList.remove('active'));
    const noneBtn = document.querySelector('.preset-filter-btn[data-preset="none"]');
    if (noneBtn) noneBtn.classList.add('active');

    updateFilterPreview();
  });
}

// FILTER PRESETS (TEMPLATES)
function setupPresets() {
  const presetButtons = document.querySelectorAll('.preset-filter-btn');
  
  const PRESET_VALUES = {
    none: { brightness: 100, contrast: 100, saturation: 100, exposure: 100, sharpness: 0, blur: 0, sepia: 0, grayscale: 0, hueRotate: 0, invert: 0 },
    auto: { brightness: 105, contrast: 112, saturation: 115, exposure: 102, sharpness: 20, blur: 0, sepia: 0, grayscale: 0, hueRotate: 0, invert: 0 },
    cyberpunk: { brightness: 90, contrast: 125, saturation: 150, exposure: 95, sharpness: 10, blur: 0, sepia: 0, grayscale: 0, hueRotate: 280, invert: 0 },
    vintage: { brightness: 95, contrast: 90, saturation: 75, exposure: 105, sharpness: 0, blur: 0.5, sepia: 35, grayscale: 0, hueRotate: 10, invert: 0 },
    noir: { brightness: 100, contrast: 145, saturation: 0, exposure: 100, sharpness: 25, blur: 0, sepia: 15, grayscale: 100, hueRotate: 0, invert: 0 },
    vibrant: { brightness: 100, contrast: 108, saturation: 135, exposure: 105, sharpness: 15, blur: 0, sepia: 0, grayscale: 0, hueRotate: 0, invert: 0 },
    matte: { brightness: 110, contrast: 80, saturation: 75, exposure: 110, sharpness: 0, blur: 0, sepia: 8, grayscale: 0, hueRotate: 0, invert: 0 }
  };

  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      presetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const presetKey = btn.getAttribute('data-preset');
      const values = PRESET_VALUES[presetKey];
      if (!values) return;

      currentFilters = { ...values };

      // Update DOM sliders & text displays
      const sliders = [
        { id: 'brightness', unit: '%' },
        { id: 'contrast', unit: '%' },
        { id: 'saturation', unit: '%' },
        { id: 'exposure', unit: '%' },
        { id: 'sharpness', unit: 'px' },
        { id: 'blur', unit: 'px' },
        { id: 'sepia', unit: '%' },
        { id: 'grayscale', unit: '%' },
        { id: 'hue-rotate', unit: '°', key: 'hueRotate' },
        { id: 'invert', unit: '%' }
      ];

      sliders.forEach(s => {
        const slider = document.getElementById(`slider-${s.id}`);
        const display = document.getElementById(`val-${s.id}`);
        const key = s.key || s.id;
        if (slider && display) {
          slider.value = values[key];
          display.textContent = `${values[key]}${s.unit}`;
        }
      });

      // Update Preview Style
      const preview = document.getElementById('preview-image');
      if (preview) {
        const f = currentFilters;
        const brightnessVal = (f.brightness * (f.exposure / 100)).toFixed(1);
        preview.style.filter = `
          brightness(${brightnessVal}%) 
          contrast(${f.contrast}%) 
          saturate(${f.saturation}%) 
          grayscale(${f.grayscale}%) 
          sepia(${f.sepia}%) 
          hue-rotate(${f.hueRotate}deg) 
          invert(${f.invert}%) 
          blur(${f.blur}px)
        `;
      }

      logStatus("Applied preset template: " + btn.textContent.trim());
    });
  });
}

// MODE SWITCHING
function setupModeSwitching() {
  const btnSingle = document.getElementById('btn-single-mode');
  const btnBulk = document.getElementById('btn-bulk-mode');
  const viewSingle = document.getElementById('single-viewport');
  const viewBulk = document.getElementById('bulk-viewport');
  const exportBtn = document.getElementById('btn-export');
  const cropPresets = document.getElementById('crop-presets-container');

  btnSingle.addEventListener('click', () => {
    state.mode = 'single';
    btnSingle.classList.add('active');
    btnBulk.classList.remove('active');
    viewSingle.classList.add('active');
    viewBulk.classList.remove('active');
    cropPresets.classList.remove('hidden');
    
    // Toggle export button text & status
    exportBtn.innerHTML = `<i class="fa-solid fa-download"></i> Process &amp; Save Image`;
    toggleExportButtonState();
    updateStatusDetails();
  });

  btnBulk.addEventListener('click', () => {
    state.mode = 'bulk';
    btnBulk.classList.add('active');
    btnSingle.classList.remove('active');
    viewBulk.classList.add('active');
    viewSingle.classList.remove('active');
    cropPresets.classList.add('hidden');
    
    // Close cropper if open
    disableCropper();
    
    exportBtn.innerHTML = `<i class="fa-solid fa-download"></i> Process &amp; Export ZIP`;
    toggleExportButtonState();
    updateStatusDetails();
  });
}

// FILE UPLOAD AND DRAG-AND-DROP
function setupFileUpload() {
  const fileInputSingle = document.getElementById('file-input-single');
  const fileInputBulk = document.getElementById('file-input-bulk');
  
  // Triggers
  document.querySelectorAll('.upload-trigger-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (state.mode === 'single') {
        fileInputSingle.click();
      } else {
        fileInputBulk.click();
      }
    });
  });

  // Handle single upload
  fileInputSingle.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      processSingleFile(e.target.files[0]);
    }
  });

  // Handle bulk upload
  fileInputBulk.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      processBulkFiles(e.target.files);
    }
  });

  // Drag & drop logic
  document.querySelectorAll('.upload-zone').forEach(zone => {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('dragover');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('dragover');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        if (state.mode === 'single') {
          processSingleFile(files[0]);
        } else {
          processBulkFiles(files);
        }
      }
    });
  });

  // Paste single image from clipboard
  document.addEventListener('paste', (e) => {
    if (state.mode !== 'single') return;
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        processSingleFile(file);
        break;
      }
    }
  });
}

// SINGLE IMAGE WORKFLOW
function processSingleFile(file) {
  state.single.file = file;
  
  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      state.single.img = img;
      state.single.originalWidth = img.width;
      state.single.originalHeight = img.height;
      state.single.currentWidth = img.width;
      state.single.currentHeight = img.height;
      state.single.rotation = 0;
      state.single.flipH = false;
      state.single.flipV = false;
      state.single.zoom = 1;
      
      // Reset canvas history
      state.single.history = [];
      state.single.historyIndex = -1;
      
      // Render optimized display preview to DOM (prevents browser reflow/repaint lag)
      updateDOMPreview(img);
      
      document.getElementById('single-upload-prompt').classList.add('hidden');
      document.getElementById('image-container').classList.remove('hidden');
      document.getElementById('single-toolbar').classList.remove('hidden');
      
      // Initialize inputs with original dimensions
      document.getElementById('input-width').value = img.width;
      document.getElementById('input-height').value = img.height;
      
      // Save initial history
      saveHistoryState();
      
      toggleExportButtonState();
      updateStatusDetails();
      logStatus("Loaded image: " + file.name);
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

// BULK IMAGES QUEUE WORKFLOW
// BULK IMAGES QUEUE WORKFLOW
function processBulkFiles(fileList) {
  const isFirstBatch = state.bulk.queue.length === 0;

  Array.from(fileList).forEach(file => {
    // Check if duplicate in queue
    if (state.bulk.queue.some(item => item.file.name === file.name && item.file.size === file.size)) {
      return;
    }

    const item = {
      id: Math.random().toString(36).substring(2, 9),
      file: file,
      name: file.name,
      sizeText: formatBytes(file.size),
      status: 'pending',
      imgSrc: null
    };

    // Append card to DOM immediately (no rebuilding of other cards!)
    appendBulkCardToDOM(item);
    state.bulk.queue.push(item);

    // Load preview thumbnail asynchronously using temporary object URL
    const tempUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const maxDim = 120;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > h) {
        if (w > maxDim) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        }
      } else {
        if (h > maxDim) {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      item.imgSrc = canvas.toDataURL('image/jpeg', 0.7); // Tiny compressed JPEG
      
      // Update only this specific card's thumbnail and status in the DOM
      updateBulkCardInDOM(item);

      // Revoke the object URL to release the memory
      URL.revokeObjectURL(tempUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(tempUrl);
    };

    img.src = tempUrl;
  });

  if (isFirstBatch && state.bulk.queue.length > 0) {
    document.getElementById('bulk-upload-zone').classList.add('hidden');
    document.getElementById('bulk-queue-container').classList.remove('hidden');
  }

  document.getElementById('bulk-queue-count').textContent = state.bulk.queue.length;
  toggleExportButtonState();
  updateStatusDetails();
  logStatus(`Queued ${state.bulk.queue.length} images`);
}

// APPEND A SINGLE CARD TO BULK GRID (INCREMENTAL DOM UPDATE)
function appendBulkCardToDOM(item) {
  const grid = document.getElementById('bulk-image-grid');
  if (!grid) return;

  const card = document.createElement('div');
  card.className = 'bulk-card';
  card.setAttribute('data-id', item.id);
  card.innerHTML = `
    <button class="card-delete" onclick="removeBulkItem('${item.id}')"><i class="fa-solid fa-xmark"></i></button>
    <div class="thumb-wrap">
      <i class="fa-regular fa-image" style="font-size: 28px; color: var(--text-secondary);"></i>
    </div>
    <div class="card-info">
      <span class="img-name" title="${item.name}">${item.name}</span>
      <span class="img-size">${item.sizeText}</span>
    </div>
    <span class="card-badge ${item.status}">${item.status}</span>
  `;
  grid.appendChild(card);
}

// UPDATE A SINGLE CARD IN DOM (TARGETED DOM UPDATE)
function updateBulkCardInDOM(item) {
  const card = document.querySelector(`.bulk-card[data-id="${item.id}"]`);
  if (!card) return;

  // Update thumbnail if loaded
  const thumbWrap = card.querySelector('.thumb-wrap');
  if (thumbWrap && item.imgSrc) {
    thumbWrap.innerHTML = `<img src="${item.imgSrc}">`;
  }

  // Update status badge
  const badge = card.querySelector('.card-badge');
  if (badge) {
    badge.className = `card-badge ${item.status}`;
    badge.textContent = item.status;
  }
}

// RENDER BULK GRID (FULL REBUILD - ONLY USED WHEN REDRAWING ENTIRE QUEUE)
function renderBulkQueue() {
  const grid = document.getElementById('bulk-image-grid');
  if (!grid) return;
  grid.innerHTML = '';
  
  state.bulk.queue.forEach(item => {
    appendBulkCardToDOM(item);
    if (item.imgSrc) {
      updateBulkCardInDOM(item);
    }
  });

  document.getElementById('bulk-queue-count').textContent = state.bulk.queue.length;
}

// REMOVE ITEM FROM BULK (TARGETED DOM REMOVAL)
window.removeBulkItem = function(id) {
  state.bulk.queue = state.bulk.queue.filter(item => item.id !== id);
  
  const card = document.querySelector(`.bulk-card[data-id="${id}"]`);
  if (card) {
    card.remove();
  }
  
  document.getElementById('bulk-queue-count').textContent = state.bulk.queue.length;

  if (state.bulk.queue.length === 0) {
    document.getElementById('bulk-upload-zone').classList.remove('hidden');
    document.getElementById('bulk-queue-container').classList.add('hidden');
  }
  
  toggleExportButtonState();
  updateStatusDetails();
  logStatus("Removed queue item");
};

// CLEAR ALL BULK QUEUE
document.getElementById('btn-clear-queue').addEventListener('click', () => {
  state.bulk.queue = [];
  const grid = document.getElementById('bulk-image-grid');
  if (grid) grid.innerHTML = '';
  
  document.getElementById('bulk-upload-zone').classList.remove('hidden');
  document.getElementById('bulk-queue-container').classList.add('hidden');
  toggleExportButtonState();
  updateStatusDetails();
  logStatus("Cleared queue");
});

// RENDER SAMPLE IMAGE PROCEDURALLY (100% OFFLINE)
function loadSampleImage() {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 800;
  const ctx = canvas.getContext('2d');
  
  // Render bright landscape background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 800);
  grad.addColorStop(0, '#e0f2fe'); // Sky Blue
  grad.addColorStop(0.4, '#fbcfe8'); // Pastel Pink
  grad.addColorStop(0.7, '#fae8ff'); // Pastel Purple
  grad.addColorStop(1, '#f1f5f9'); // Clean light gray
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1200, 800);
  
  // Draw abstract bright sun
  const radialGrad = ctx.createRadialGradient(600, 520, 30, 600, 520, 220);
  radialGrad.addColorStop(0, 'rgba(253, 224, 71, 0.6)'); // Yellow
  radialGrad.addColorStop(0.4, 'rgba(244, 63, 94, 0.25)'); // Rose
  radialGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = radialGrad;
  ctx.beginPath();
  ctx.arc(600, 520, 220, 0, Math.PI * 2);
  ctx.fill();

  // Draw some mountains silhouettes in light contrast colors
  ctx.fillStyle = '#e2e8f0'; // Light slate mountain
  ctx.beginPath();
  ctx.moveTo(0, 800);
  ctx.lineTo(0, 560);
  ctx.quadraticCurveTo(200, 490, 450, 610);
  ctx.quadraticCurveTo(700, 710, 950, 540);
  ctx.lineTo(1200, 630);
  ctx.lineTo(1200, 800);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#cbd5e1'; // Darker slate mountain
  ctx.beginPath();
  ctx.moveTo(0, 800);
  ctx.lineTo(0, 690);
  ctx.quadraticCurveTo(300, 590, 650, 730);
  ctx.quadraticCurveTo(900, 790, 1200, 700);
  ctx.lineTo(1200, 800);
  ctx.closePath();
  ctx.fill();
  
  // Draw light grid floor lines
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.05)';
  ctx.lineWidth = 1.5;
  for(let x=0; x<=1200; x+=80) {
    ctx.beginPath();
    ctx.moveTo(x, 710);
    ctx.lineTo(x + (x - 600) * 1.5, 800);
    ctx.stroke();
  }
  for(let y=710; y<=800; y+=25) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1200, y);
    ctx.stroke();
  }

  // Draw Title text
  ctx.fillStyle = '#0f172a';
  ctx.font = "bold 44px 'Space Grotesk', sans-serif";
  ctx.textAlign = 'center';
  ctx.fillText("SMBIFY IMAGE ENVIRONMENT", 600, 320);
  
  ctx.fillStyle = '#475569';
  ctx.font = "500 18px 'Inter', sans-serif";
  ctx.fillText("Upload an image, drag & drop, or paste to begin", 600, 365);

  // Load this canvas as single mode image
  canvas.toBlob((blob) => {
    const file = new File([blob], "smbify_demo.jpg", { type: "image/jpeg" });
    processSingleFile(file);
  }, "image/jpeg", 0.95);
}

// SINGLE MODE ACTIONS TOOLBAR
function setupToolbar() {
  const imgContainer = document.getElementById('image-container');
  const preview = document.getElementById('preview-image');
  
  // Rotations
  document.getElementById('btn-rotate-cw').addEventListener('click', () => {
    state.single.rotation = (state.single.rotation + 90) % 360;
    applyTransforms();
    saveHistoryState();
  });

  document.getElementById('btn-rotate-ccw').addEventListener('click', () => {
    state.single.rotation = (state.single.rotation - 90 + 360) % 360;
    applyTransforms();
    saveHistoryState();
  });

  // Flips
  document.getElementById('btn-flip-h').addEventListener('click', () => {
    state.single.flipH = !state.single.flipH;
    applyTransforms();
    saveHistoryState();
  });

  document.getElementById('btn-flip-v').addEventListener('click', () => {
    state.single.flipV = !state.single.flipV;
    applyTransforms();
    saveHistoryState();
  });

  // Zoom Controls
  document.getElementById('btn-zoom-in').addEventListener('click', () => {
    adjustZoom(0.15);
  });

  document.getElementById('btn-zoom-out').addEventListener('click', () => {
    adjustZoom(-0.15);
  });

  document.getElementById('btn-zoom-fit').addEventListener('click', () => {
    state.single.zoom = 1;
    imgContainer.style.transform = `scale(1) translate(0px, 0px)`;
    document.getElementById('zoom-level').textContent = "100%";
  });

  // Crop toggle button
  document.getElementById('btn-crop-toggle').addEventListener('click', () => {
    if (state.crop.active) {
      disableCropper();
    } else {
      enableCropper();
    }
  });

  // Apply Crop in Single Mode
  document.getElementById('btn-crop-apply').addEventListener('click', () => {
    if (!state.crop.active || !state.single.img) return;

    const preview = document.getElementById('preview-image');
    
    // Calculate crop ratios relative to the displayed preview dimensions
    const scaleX = state.single.img.naturalWidth / preview.clientWidth;
    const scaleY = state.single.img.naturalHeight / preview.clientHeight;

    const cropX = state.crop.boxX * scaleX;
    const cropY = state.crop.boxY * scaleY;
    const cropW = state.crop.boxW * scaleX;
    const cropH = state.crop.boxH * scaleY;

    // Create a canvas to extract the cropped region
    const canvas = document.createElement('canvas');
    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext('2d');

    // Draw the cropped portion of the original image
    ctx.drawImage(state.single.img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    // Convert canvas to Image
    const croppedImg = new Image();
    croppedImg.onload = () => {
      state.single.img = croppedImg;
      state.single.originalWidth = croppedImg.width;
      state.single.originalHeight = croppedImg.height;
      state.single.currentWidth = croppedImg.width;
      state.single.currentHeight = croppedImg.height;
      
      // Update preview image src with downscaled version to prevent paint lag
      updateDOMPreview(croppedImg);
      
      disableCropper();
      
      // Reset inputs
      document.getElementById('input-width').value = croppedImg.width;
      document.getElementById('input-height').value = croppedImg.height;

      applyTransforms();
      saveHistoryState();
      logStatus("Image cropped successfully");
    };
    croppedImg.src = canvas.toDataURL();
  });

  // Aspect ratio presets listeners
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const ratio = btn.getAttribute('data-ratio');
      state.crop.ratio = ratio;
      
      if (state.crop.active) {
        updateCropBoxRatio();
      }
    });
  });
}

// TRANSFORMS & ZOOM STYLING PREVIEW
function applyTransforms() {
  const preview = document.getElementById('preview-image');
  const cropper = document.getElementById('cropper-box');
  
  if (!preview) return;
  
  let transformStr = `rotate(${state.single.rotation}deg)`;
  if (state.single.flipH) transformStr += ' scaleX(-1)';
  if (state.single.flipV) transformStr += ' scaleY(-1)';
  
  preview.style.transform = transformStr;
  
  // Sizing dimensions logic under rotations
  if (state.single.rotation % 180 !== 0) {
    state.single.currentWidth = state.single.originalHeight;
    state.single.currentHeight = state.single.originalWidth;
  } else {
    state.single.currentWidth = state.single.originalWidth;
    state.single.currentHeight = state.single.originalHeight;
  }
  
  document.getElementById('input-width').value = state.single.currentWidth;
  document.getElementById('input-height').value = state.single.currentHeight;

  // Make sure cropper gets disabled on rotation as coordinate mapping changes
  disableCropper();
  updateStatusDetails();
}

function adjustZoom(factor) {
  state.single.zoom = Math.max(0.2, Math.min(4, state.single.zoom + factor));
  const container = document.getElementById('image-container');
  container.style.transform = `scale(${state.single.zoom})`;
  document.getElementById('zoom-level').textContent = `${Math.round(state.single.zoom * 100)}%`;
}

// SIZING CONTROL CONFIGS
function setupResizeMode() {
  const selectMode = document.getElementById('select-resize-mode');
  const customInputs = document.getElementById('custom-size-inputs');
  const lockCheckbox = document.getElementById('size-lock-checkbox');
  const limitInput = document.getElementById('limit-size-input');

  const widthIn = document.getElementById('input-width');
  const heightIn = document.getElementById('input-height');
  const chkAspect = document.getElementById('chk-aspect-ratio');

  selectMode.addEventListener('change', (e) => {
    const val = e.target.value;
    
    customInputs.classList.add('hidden');
    lockCheckbox.classList.add('hidden');
    limitInput.classList.add('hidden');
    
    // Ensure both inputs are visible by default before toggling
    widthIn.parentElement.classList.remove('hidden');
    heightIn.parentElement.classList.remove('hidden');

    if (val === 'custom') {
      customInputs.classList.remove('hidden');
      lockCheckbox.classList.remove('hidden');
    } else if (val === 'width') {
      customInputs.classList.remove('hidden');
      heightIn.parentElement.classList.add('hidden');
    } else if (val === 'height') {
      customInputs.classList.remove('hidden');
      widthIn.parentElement.classList.add('hidden');
    } else if (val === 'limit') {
      limitInput.classList.remove('hidden');
    }
  });

  // Keep aspect ratios sizing logic
  widthIn.addEventListener('input', () => {
    if (chkAspect.checked && selectMode.value === 'custom') {
      const ratio = state.single.currentHeight / state.single.currentWidth;
      heightIn.value = Math.round(widthIn.value * ratio);
    }
  });

  heightIn.addEventListener('input', () => {
    if (chkAspect.checked && selectMode.value === 'custom') {
      const ratio = state.single.currentWidth / state.single.currentHeight;
      widthIn.value = Math.round(heightIn.value * ratio);
    }
  });
}

// INTERACTIVE CROP BOX COMPONENT
function enableCropper() {
  const preview = document.getElementById('preview-image');
  const cropper = document.getElementById('cropper-box');
  const btn = document.getElementById('btn-crop-toggle');
  const applyBtn = document.getElementById('btn-crop-apply');

  if (!state.single.img) return;

  state.crop.active = true;
  btn.classList.add('active');
  cropper.classList.remove('hidden');
  if (applyBtn) applyBtn.classList.remove('hidden');

  // Align crop boundaries with current image dimensions
  const w = preview.clientWidth;
  const h = preview.clientHeight;

  // Render centered initial crop box
  state.crop.boxW = w * 0.8;
  state.crop.boxH = h * 0.8;
  state.crop.boxX = (w - state.crop.boxW) / 2;
  state.crop.boxY = (h - state.crop.boxH) / 2;

  updateCropBoxRatio();
  renderCropBox();
  logStatus("Cropper overlay active");
}

function disableCropper() {
  const cropper = document.getElementById('cropper-box');
  const btn = document.getElementById('btn-crop-toggle');
  const applyBtn = document.getElementById('btn-crop-apply');
  
  state.crop.active = false;
  if(btn) btn.classList.remove('active');
  if(cropper) cropper.classList.add('hidden');
  if (applyBtn) applyBtn.classList.add('hidden');
}

function updateCropBoxRatio() {
  const preview = document.getElementById('preview-image');
  const imgW = preview.clientWidth;
  const imgH = preview.clientHeight;
  const ratio = state.crop.ratio;

  if (ratio === 'free') return;

  let rValue = 1;
  if (ratio === '1:1') rValue = 1;
  else if (ratio === '16:9') rValue = 16 / 9;
  else if (ratio === '4:3') rValue = 4 / 3;
  else if (ratio === '3:2') rValue = 3 / 2;

  // Recalculate crop dimensions matching preset ratio
  if (state.crop.boxW / state.crop.boxH > rValue) {
    state.crop.boxW = state.crop.boxH * rValue;
  } else {
    state.crop.boxH = state.crop.boxW / rValue;
  }
  
  // Snap validation bounds
  if (state.crop.boxW > imgW) {
    state.crop.boxW = imgW;
    state.crop.boxH = imgW / rValue;
  }
  if (state.crop.boxH > imgH) {
    state.crop.boxH = imgH;
    state.crop.boxW = imgH * rValue;
  }

  // Centering crop box boundaries
  state.crop.boxX = (imgW - state.crop.boxW) / 2;
  state.crop.boxY = (imgH - state.crop.boxH) / 2;

  renderCropBox();
}

function renderCropBox() {
  const cropper = document.getElementById('cropper-box');
  cropper.style.left = `${state.crop.boxX}px`;
  cropper.style.top = `${state.crop.boxY}px`;
  cropper.style.width = `${state.crop.boxW}px`;
  cropper.style.height = `${state.crop.boxH}px`;
}

function initCropperEvents() {
  const cropper = document.getElementById('cropper-box');
  const preview = document.getElementById('preview-image');
  
  let isDragging = false;
  let isResizing = false;
  let currentHandle = '';

  const handlePointerDown = (e) => {
    const target = e.target;
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;

    if (target.classList.contains('cropper-handle')) {
      isResizing = true;
      currentHandle = target.classList[1]; // tl, tr, bl, br
      e.stopPropagation();
    } else if (target.id === 'cropper-box' || target.parentElement.id === 'cropper-box') {
      isDragging = true;
      e.stopPropagation();
    }

    state.crop.startX = clientX;
    state.crop.startY = clientY;
    state.crop.startW = state.crop.boxW;
    state.crop.startH = state.crop.boxH;
    state.crop.startLeft = state.crop.boxX;
    state.crop.startTop = state.crop.boxY;
  };

  const handlePointerMove = (e) => {
    if (!isDragging && !isResizing) return;
    
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    if (!clientX || !clientY) return;

    const dx = clientX - state.crop.startX;
    const dy = clientY - state.crop.startY;

    const imgW = preview.clientWidth;
    const imgH = preview.clientHeight;

    if (isDragging) {
      // Calculate drag margins
      let newX = state.crop.startLeft + dx;
      let newY = state.crop.startTop + dy;

      newX = Math.max(0, Math.min(imgW - state.crop.boxW, newX));
      newY = Math.max(0, Math.min(imgH - state.crop.boxH, newY));

      state.crop.boxX = newX;
      state.crop.boxY = newY;
    } 
    else if (isResizing) {
      let newW = state.crop.startW;
      let newH = state.crop.startH;
      let newX = state.crop.boxX;
      let newY = state.crop.boxY;

      // Handle calculations
      if (currentHandle === 'br') {
        newW = Math.max(30, state.crop.startW + dx);
        newH = Math.max(30, state.crop.startH + dy);
      } else if (currentHandle === 'bl') {
        newW = Math.max(30, state.crop.startW - dx);
        newH = Math.max(30, state.crop.startH + dy);
        if (newW > 30) newX = state.crop.startLeft + dx;
      } else if (currentHandle === 'tr') {
        newW = Math.max(30, state.crop.startW + dx);
        newH = Math.max(30, state.crop.startH - dy);
        if (newH > 30) newY = state.crop.startTop + dy;
      } else if (currentHandle === 'tl') {
        newW = Math.max(30, state.crop.startW - dx);
        newH = Math.max(30, state.crop.startH - dy);
        if (newW > 30) newX = state.crop.startLeft + dx;
        if (newH > 30) newY = state.crop.startTop + dy;
      }

      // Aspect Ratio Lock recalculation
      if (state.crop.ratio !== 'free') {
        let ratioVal = 1;
        const ratio = state.crop.ratio;
        if (ratio === '1:1') ratioVal = 1;
        else if (ratio === '16:9') ratioVal = 16 / 9;
        else if (ratio === '4:3') ratioVal = 4 / 3;
        else if (ratio === '3:2') ratioVal = 3 / 2;

        if (currentHandle === 'br' || currentHandle === 'bl') {
          newH = newW / ratioVal;
        } else {
          newW = newH * ratioVal;
        }
      }

      // Bounds validation check
      if (newX >= 0 && newY >= 0 && (newX + newW) <= imgW && (newY + newH) <= imgH) {
        state.crop.boxW = newW;
        state.crop.boxH = newH;
        state.crop.boxX = newX;
        state.crop.boxY = newY;
      }
    }

    renderCropBox();
  };

  const handlePointerUp = () => {
    isDragging = false;
    isResizing = false;
  };

  // Mouse bindings
  cropper.addEventListener('mousedown', handlePointerDown);
  document.addEventListener('mousemove', handlePointerMove);
  document.addEventListener('mouseup', handlePointerUp);

  // Touch bindings
  cropper.addEventListener('touchstart', handlePointerDown);
  document.addEventListener('touchmove', handlePointerMove);
  document.addEventListener('touchend', handlePointerUp);
}

// EXIF / SPOOFING METADATA PANEL SETTINGS
function setupEXIFControls() {
  const chkInject = document.getElementById('chk-inject-exif');
  const exifForm = document.getElementById('exif-details-form');
  const selectPreset = document.getElementById('select-camera-preset');
  const cameraCustom = document.getElementById('custom-camera-inputs');
  
  const makeIn = document.getElementById('input-camera-make');
  const modelIn = document.getElementById('input-camera-model');
  
  const selectGPS = document.getElementById('select-gps-preset');
  const gpsCustom = document.getElementById('custom-gps-inputs');
  const latIn = document.getElementById('input-gps-lat');
  const lngIn = document.getElementById('input-gps-lng');

  const selectDate = document.getElementById('select-date-preset');
  const dateCustom = document.getElementById('custom-date-input');

  chkInject.addEventListener('change', () => {
    if (chkInject.checked) {
      exifForm.classList.remove('hidden');
    } else {
      exifForm.classList.add('hidden');
    }
  });

  selectPreset.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'custom') {
      cameraCustom.classList.remove('hidden');
    } else {
      cameraCustom.classList.add('hidden');
      const p = CAMERA_PRESETS[val];
      makeIn.value = p.make;
      modelIn.value = p.model;
    }
  });

  // Trigger initial setup
  selectPreset.dispatchEvent(new Event('change'));

  selectGPS.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'custom') {
      gpsCustom.classList.remove('hidden');
    } else {
      gpsCustom.classList.add('hidden');
      if (val !== 'none') {
        const p = GPS_PRESETS[val];
        latIn.value = p.lat;
        lngIn.value = p.lng;
      }
    }
  });

  selectDate.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'manual') {
      dateCustom.classList.remove('hidden');
      // Set to current date as baseline placeholder
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      document.getElementById('input-creation-date').value = now.toISOString().slice(0, 16);
    } else {
      dateCustom.classList.add('hidden');
    }
  });
}

// SECURITY ANTI-SPAM SETTINGS
function setupFilenameControls() {
  const selectFormat = document.getElementById('select-filename-format');
  const customPrefix = document.getElementById('custom-filename-prefix');

  selectFormat.addEventListener('change', (e) => {
    if (e.target.value === 'custom') {
      customPrefix.classList.remove('hidden');
    } else {
      customPrefix.classList.add('hidden');
    }
  });
}

// UNDO REDO IMPLEMENTATION
function setupUndoRedo() {
  document.getElementById('btn-undo').addEventListener('click', () => {
    if (state.single.historyIndex > 0) {
      state.single.historyIndex--;
      restoreHistoryState();
      logStatus("Undo operation");
    }
  });

  document.getElementById('btn-redo').addEventListener('click', () => {
    if (state.single.historyIndex < state.single.history.length - 1) {
      state.single.historyIndex++;
      restoreHistoryState();
      logStatus("Redo operation");
    }
  });
}

function saveHistoryState() {
  if (state.mode !== 'single') return;
  
  // Clone image data/state (preserving image reference for crop undo)
  const currentState = {
    img: state.single.img,
    rotation: state.single.rotation,
    flipH: state.single.flipH,
    flipV: state.single.flipV,
    crop: state.crop.active ? { ...state.crop } : null
  };

  // If we had changes after history index, discard them (standard undo-redo branch)
  if (state.single.historyIndex < state.single.history.length - 1) {
    state.single.history = state.single.history.slice(0, state.single.historyIndex + 1);
  }

  state.single.history.push(currentState);
  state.single.historyIndex++;
  
  updateUndoRedoButtons();
}

function restoreHistoryState() {
  const hState = state.single.history[state.single.historyIndex];
  if (!hState) return;

  // Restore image reference and dimensions
  state.single.img = hState.img;
  state.single.originalWidth = hState.img.width;
  state.single.originalHeight = hState.img.height;
  state.single.currentWidth = hState.img.width;
  state.single.currentHeight = hState.img.height;

  state.single.rotation = hState.rotation;
  state.single.flipH = hState.flipH;
  state.single.flipV = hState.flipV;

  // Update DOM preview element to display the corrected/restored image
  updateDOMPreview(hState.img);

  applyTransforms();
  updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
  const undoBtn = document.getElementById('btn-undo');
  const redoBtn = document.getElementById('btn-redo');

  undoBtn.disabled = state.single.historyIndex <= 0;
  redoBtn.disabled = state.single.historyIndex >= state.single.history.length - 1;
}

// SHARPENING CONVOLUTION ENGINE (FOR CANVAS OUTPUTS)
function applySharpenKernel(imageData, sharpnessVal) {
  if (sharpnessVal <= 0) return imageData;
  
  const src = imageData.data;
  const w = imageData.width;
  const h = imageData.height;
  const output = new ImageData(new Uint8ClampedArray(src.length), w, h);
  const dst = output.data;
  
  // Calculate laplacian matrix coefficient matching slider
  const a = sharpnessVal * 0.02;
  const kernel = [
     0,  -a,   0,
    -a, 1 + 4*a, -a,
     0,  -a,   0
  ];
  
  const side = 3;
  const halfSide = 1;
  
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sy = y;
      const sx = x;
      const dstOff = (y * w + x) * 4;
      
      let r = 0, g = 0, b = 0;
      
      for (let cy = 0; cy < side; cy++) {
        for (let cx = 0; cx < side; cx++) {
          const scy = Math.min(h - 1, Math.max(0, sy + cy - halfSide));
          const scx = Math.min(w - 1, Math.max(0, sx + cx - halfSide));
          const srcOff = (scy * w + scx) * 4;
          const wt = kernel[cy * side + cx];
          
          r += src[srcOff] * wt;
          g += src[srcOff + 1] * wt;
          b += src[srcOff + 2] * wt;
        }
      }
      
      dst[dstOff] = Math.min(255, Math.max(0, r));
      dst[dstOff + 1] = Math.min(255, Math.max(0, g));
      dst[dstOff + 2] = Math.min(255, Math.max(0, b));
      dst[dstOff + 3] = src[dstOff + 3]; // Preserve alpha
    }
  }
  return output;
}

// CANVAS DRAW & PROCESSING MATRIX
function processImageToCanvas(imgElement, filters, transforms, sizeSettings, microTweakSettings) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  let origW = imgElement.naturalWidth || imgElement.width;
  let origH = imgElement.naturalHeight || imgElement.height;

  // Apply micro-tweaks to dimensions if enabled
  if (microTweakSettings && microTweakSettings.enabled) {
    // Trim 0 to 2 pixels randomly
    origW -= Math.floor(Math.random() * 3);
    origH -= Math.floor(Math.random() * 3);
  }

  // Handle rotational dimensions swapping
  let drawW = origW;
  let drawH = origH;
  if (transforms && transforms.rotation % 180 !== 0) {
    drawW = origH;
    drawH = origW;
  }

  // Sizing and Rescaling calculation
  let targetW = drawW;
  let targetH = drawH;
  
  if (sizeSettings) {
    const mode = sizeSettings.mode;
    if (mode === 'custom') {
      targetW = sizeSettings.width || drawW;
      targetH = sizeSettings.height || drawH;
    } else if (mode === 'width') {
      targetW = sizeSettings.width || drawW;
      targetH = Math.round(targetW * (drawH / drawW));
    } else if (mode === 'height') {
      targetH = sizeSettings.height || drawH;
      targetW = Math.round(targetH * (drawW / drawH));
    } else if (mode === 'limit') {
      const maxDim = sizeSettings.maxDimension || 2048;
      if (drawW > maxDim || drawH > maxDim) {
        if (drawW > drawH) {
          targetW = maxDim;
          targetH = Math.round(maxDim * (drawH / drawW));
        } else {
          targetH = maxDim;
          targetW = Math.round(maxDim * (drawW / drawH));
        }
      }
    }
  }

  canvas.width = targetW;
  canvas.height = targetH;

  // Draw setup
  ctx.save();
  
  // Set centering anchor offsets
  ctx.translate(targetW / 2, targetH / 2);
  
  // Apply rotation
  if (transforms && transforms.rotation) {
    ctx.rotate((transforms.rotation * Math.PI) / 180);
  }
  
  // Apply flips
  const scaleX = (transforms && transforms.flipH) ? -1 : 1;
  const scaleY = (transforms && transforms.flipV) ? -1 : 1;
  ctx.scale(scaleX, scaleY);

  // Apply filters on canvas 2D context using modern built-in filter string
  let brightnessFactor = filters.brightness;
  let contrastVal = filters.contrast;
  let saturationVal = filters.saturation;
  
  if (microTweakSettings && microTweakSettings.enabled) {
    // Add minor shifts to visual components
    brightnessFactor += (Math.random() * 0.8 - 0.4);
    contrastVal += (Math.random() * 0.8 - 0.4);
    saturationVal += (Math.random() * 0.8 - 0.4);
  }

  const brightnessStringVal = (brightnessFactor * (filters.exposure / 100)).toFixed(2);
  
  ctx.filter = `
    brightness(${brightnessStringVal}%) 
    contrast(${contrastVal}%) 
    saturate(${saturationVal}%) 
    grayscale(${filters.grayscale}%) 
    sepia(${filters.sepia}%) 
    hue-rotate(${filters.hueRotate}deg) 
    invert(${filters.invert}%) 
    blur(${filters.blur}px)
  `;

  // Calculate source crop region on original dimensions (for bulk edge trimming / anti-spam hashing)
  let cropLeft = 0, cropRight = 0, cropTop = 0, cropBottom = 0;
  const bulkCropSelect = document.getElementById('select-bulk-crop');
  const bulkCropMode = bulkCropSelect ? bulkCropSelect.value : 'none';

  if (bulkCropMode === 'uniform1') {
    cropLeft = cropRight = cropTop = cropBottom = 0.01; // 1%
  } else if (bulkCropMode === 'uniform2') {
    cropLeft = cropRight = cropTop = cropBottom = 0.02; // 2%
  } else if (bulkCropMode === 'random') {
    cropLeft = Math.random() * 0.01 + 0.005; // 0.5% - 1.5%
    cropRight = Math.random() * 0.01 + 0.005;
    cropTop = Math.random() * 0.01 + 0.005;
    cropBottom = Math.random() * 0.01 + 0.005;
  }

  const sx = origW * cropLeft;
  const sy = origH * cropTop;
  const sw = origW * (1 - cropLeft - cropRight);
  const sh = origH * (1 - cropTop - cropBottom);

  // Draw original image (or cropped sub-region) scaled correctly
  // Map dimensions back matching the rotation context
  let renderW = origW;
  let renderH = origH;
  ctx.drawImage(imgElement, sx, sy, sw, sh, -renderW / 2, -renderH / 2, renderW, renderH);
  ctx.restore();

  // Apply manual sharpening if requested (runs post-draw convolution filter)
  if (filters.sharpness > 0) {
    const imgData = ctx.getImageData(0, 0, targetW, targetH);
    const sharpenedData = applySharpenKernel(imgData, filters.sharpness);
    ctx.putImageData(sharpenedData, 0, 0);
  }

  return canvas;
}

// EXIF METADATA COMPILER (PIEXIFJS WRAPPER)
function generateEXIFBytes() {
  const inject = document.getElementById('chk-inject-exif').checked;
  if (!inject) {
    // Return empty payload bytes, stripping EXIF
    return null;
  }

  // Read configurations
  const cameraPreset = document.getElementById('select-camera-preset').value;
  let make = 'Apple';
  let model = 'iPhone 14 Pro';
  let software = 'iOS 16.3';

  if (cameraPreset === 'custom') {
    make = document.getElementById('input-camera-make').value || 'Apple';
    model = document.getElementById('input-camera-model').value || 'iPhone';
    software = 'SMBify Image Enhancer';
  } else {
    const p = CAMERA_PRESETS[cameraPreset];
    make = p.make;
    model = p.model;
    software = p.software;
  }

  // Settle Dates
  const datePreset = document.getElementById('select-date-preset').value;
  let dateObj = new Date();
  
  if (datePreset === 'rand7') {
    dateObj = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
  } else if (datePreset === 'rand30') {
    dateObj = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
  } else if (datePreset === 'manual') {
    const manualDateStr = document.getElementById('input-creation-date').value;
    if (manualDateStr) {
      dateObj = new Date(manualDateStr);
    }
  }

  // Format EXIF Date String: "YYYY:MM:DD HH:MM:SS"
  const pad = (n) => n.toString().padStart(2, '0');
  const exifDateStr = `${dateObj.getFullYear()}:${pad(dateObj.getMonth() + 1)}:${pad(dateObj.getDate())} ${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:${pad(dateObj.getSeconds())}`;

  // Assemble EXIF main tags
  const zeroth = {};
  zeroth[piexif.ImageIFD.Make] = make;
  zeroth[piexif.ImageIFD.Model] = model;
  zeroth[piexif.ImageIFD.Software] = software;
  zeroth[piexif.ImageIFD.DateTime] = exifDateStr;
  zeroth[piexif.ImageIFD.XResolution] = [72, 1];
  zeroth[piexif.ImageIFD.YResolution] = [72, 1];
  zeroth[piexif.ImageIFD.ResolutionUnit] = 2;

  // Read SEO and Brand inputs
  const titleVal = document.getElementById('input-seo-title').value.trim();
  const subjectVal = document.getElementById('input-seo-subject').value.trim();
  const keywordsVal = document.getElementById('input-seo-keywords').value.trim();
  const descriptionVal = document.getElementById('input-seo-description').value.trim();
  const authorVal = document.getElementById('input-seo-author').value.trim();
  const copyrightVal = document.getElementById('input-seo-copyright').value.trim();

  // Helper to encode string to UTF-16LE byte array for Windows-specific tags (XPTitle, XPKeywords, etc.)
  const toUtf16le = (str) => {
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      bytes.push(code & 0xff);
      bytes.push((code >> 8) & 0xff);
    }
    bytes.push(0, 0); // null terminator
    return bytes;
  };

  if (titleVal) {
    zeroth[40091] = toUtf16le(titleVal); // XPTitle
  }
  if (subjectVal) {
    zeroth[40095] = toUtf16le(subjectVal); // XPSubject
  }
  if (keywordsVal) {
    zeroth[40094] = toUtf16le(keywordsVal); // XPKeywords
  }
  if (descriptionVal) {
    zeroth[270] = descriptionVal; // ImageDescription (Standard ASCII)
    zeroth[40092] = toUtf16le(descriptionVal); // XPComment
  }
  if (authorVal) {
    zeroth[315] = authorVal; // Artist / Author (Standard ASCII)
    zeroth[40093] = toUtf16le(authorVal); // XPAuthor
  }
  if (copyrightVal) {
    zeroth[33432] = copyrightVal; // Copyright (Standard ASCII)
  }


  const exif = {};
  exif[piexif.ExifIFD.DateTimeOriginal] = exifDateStr;
  exif[piexif.ExifIFD.DateTimeDigitized] = exifDateStr;
  // Standard focal, exposure index dummy parameters to look realistic
  exif[piexif.ExifIFD.FocalLength] = [24, 1];
  exif[piexif.ExifIFD.ISOSpeedRatings] = [100];
  exif[piexif.ExifIFD.FNumber] = [18, 10]; // f/1.8

  const gps = {};
  const gpsPreset = document.getElementById('select-gps-preset').value;
  let lat = null;
  let lng = null;

  if (gpsPreset === 'custom') {
    lat = parseFloat(document.getElementById('input-gps-lat').value);
    lng = parseFloat(document.getElementById('input-gps-lng').value);
  } else if (gpsPreset !== 'none') {
    const p = GPS_PRESETS[gpsPreset];
    lat = p.lat;
    lng = p.lng;
  }

  if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
    gps[piexif.GPSIFD.GPSVersionID] = [2, 0, 0, 0];
    
    // Latitude
    gps[piexif.GPSIFD.GPSLatitudeRef] = lat >= 0 ? 'N' : 'S';
    gps[piexif.GPSIFD.GPSLatitude] = piexif.GPSHelper.degToDmsRational(Math.abs(lat));
    
    // Longitude
    gps[piexif.GPSIFD.GPSLongitudeRef] = lng >= 0 ? 'E' : 'W';
    gps[piexif.GPSIFD.GPSLongitude] = piexif.GPSHelper.degToDmsRational(Math.abs(lng));
    
    // Altitude
    gps[piexif.GPSIFD.GPSAltitudeRef] = 0; // Above sea level
    gps[piexif.GPSIFD.GPSAltitude] = [Math.floor(Math.random() * 50 + 8), 1]; // e.g. 15 meters
  }

  const exifObj = { "0th": zeroth, "Exif": exif, "GPS": gps };
  
  try {
    return piexif.dump(exifObj);
  } catch (err) {
    console.error("EXIF dump error: ", err);
    return null;
  }
}

// FILENAME GENERATOR FUNCTION
function generateFilename(originalName, index) {
  const namingScheme = document.getElementById('select-filename-format').value;
  const ext = document.getElementById('select-export-format').value === 'png' ? 'png' : 'jpg';

  const randomDigits = (digits) => {
    return Math.floor(Math.random() * Math.pow(10, digits)).toString().padStart(digits, '0');
  };

  const getBaseName = (filename) => {
    return filename.substring(0, filename.lastIndexOf('.')) || filename;
  };

  if (namingScheme === 'iphone') {
    return `IMG_${randomDigits(4)}.${ext}`;
  } 
  else if (namingScheme === 'android') {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const timeStr = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    return `${dateStr}_${timeStr}_${randomDigits(3)}.${ext}`;
  } 
  else if (namingScheme === 'sony') {
    return `DSC_${randomDigits(4)}.${ext}`;
  } 
  else if (namingScheme === 'custom') {
    const prefix = document.getElementById('input-filename-prefix').value || 'anon_';
    return `${prefix}${index + 1}_${randomDigits(4)}.${ext}`;
  } 
  else {
    // Keep Original name
    return `${getBaseName(originalName)}_enhanced.${ext}`;
  }
}

// EXPORT PIPELINE (SINGLE & BULK PROCESSING LOOP)
function setupExport() {
  const exportBtn = document.getElementById('btn-export');
  const formatSelect = document.getElementById('select-export-format');
  const qualityGroup = document.getElementById('quality-slider-group');
  const qualitySlider = document.getElementById('slider-quality');
  const valQuality = document.getElementById('val-quality');

  formatSelect.addEventListener('change', () => {
    if (formatSelect.value === 'png') {
      qualityGroup.classList.add('hidden');
    } else {
      qualityGroup.classList.remove('hidden');
    }
  });

  qualitySlider.addEventListener('input', (e) => {
    valQuality.textContent = `${e.target.value}%`;
  });

  exportBtn.addEventListener('click', () => {
    if (state.mode === 'single') {
      exportSingleImage();
    } else {
      exportBulkImages();
    }
  });
}

// EXPORT SINGLE IMAGE
function exportSingleImage() {
  if (!state.single.img) return;

  logStatus("Processing image...");
  
  const resizeMode = document.getElementById('select-resize-mode').value;
  const widthVal = parseInt(document.getElementById('input-width').value);
  const heightVal = parseInt(document.getElementById('input-height').value);
  const maxDimVal = parseInt(document.getElementById('input-max-dimension').value);
  const microTweaksEnabled = document.getElementById('chk-micro-tweaks').checked;
  const exportFormat = document.getElementById('select-export-format').value;
  const exportQuality = parseInt(document.getElementById('slider-quality').value) / 100;

  const sizeSettings = {
    mode: resizeMode,
    width: widthVal,
    height: heightVal,
    maxDimension: maxDimVal
  };

  const transforms = {
    rotation: state.single.rotation,
    flipH: state.single.flipH,
    flipV: state.single.flipV
  };

  // 1. Draw to canvas with filters & transformations
  const canvas = processImageToCanvas(state.single.img, currentFilters, transforms, sizeSettings, { enabled: microTweaksEnabled });

  // 2. Perform export
  let mimeType = 'image/jpeg';
  if (exportFormat === 'png') mimeType = 'image/png';
  else if (exportFormat === 'webp') mimeType = 'image/webp';

  const dataUrl = canvas.toDataURL(mimeType, exportQuality);
  
  // 3. Inject EXIF if requested & format is JPEG
  let finalBlob = null;
  const injectExif = document.getElementById('chk-inject-exif').checked;
  
  if (exportFormat === 'jpeg' && injectExif) {
    const exifBytes = generateEXIFBytes();
    if (exifBytes) {
      try {
        const dataUrlWithExif = piexif.insert(exifBytes, dataUrl);
        finalBlob = dataURLtoBlob(dataUrlWithExif);
      } catch (err) {
        console.error("EXIF injection failed, downloading normal image", err);
        finalBlob = dataURLtoBlob(dataUrl);
      }
    } else {
      finalBlob = dataURLtoBlob(dataUrl);
    }
  } else {
    finalBlob = dataURLtoBlob(dataUrl);
  }

  // 4. Download file
  const outName = generateFilename(state.single.file ? state.single.file.name : 'image.jpg', 0);
  triggerDownload(finalBlob, outName);
  logStatus("Saved image successfully!");
}

// BATCH PROCESSING LOOP
async function exportBulkImages() {
  if (state.bulk.queue.length === 0) return;

  logStatus("Starting bulk enhancement...");
  
  const progressWrapper = document.getElementById('export-progress-wrapper');
  const progressText = document.getElementById('export-progress-text');
  const progressPct = document.getElementById('export-progress-pct');
  const progressFill = document.getElementById('export-progress-fill');
  const exportBtn = document.getElementById('btn-export');

  // Disable button and show progress indicator
  exportBtn.disabled = true;
  progressWrapper.classList.remove('hidden');

  const zip = new JSZip();
  const queue = state.bulk.queue;
  const total = queue.length;

  const resizeMode = document.getElementById('select-resize-mode').value;
  const widthVal = parseInt(document.getElementById('input-width').value);
  const heightVal = parseInt(document.getElementById('input-height').value);
  const maxDimVal = parseInt(document.getElementById('input-max-dimension').value);
  const microTweaksEnabled = document.getElementById('chk-micro-tweaks').checked;
  const exportFormat = document.getElementById('select-export-format').value;
  const exportQuality = parseInt(document.getElementById('slider-quality').value) / 100;
  const injectExif = document.getElementById('chk-inject-exif').checked;

  const sizeSettings = {
    mode: resizeMode,
    width: widthVal,
    height: heightVal,
    maxDimension: maxDimVal
  };

  const transforms = { rotation: 0, flipH: false, flipV: false };

  // Loop through files sequentially
  for (let i = 0; i < total; i++) {
    const item = queue[i];
    item.status = 'processing';
    updateBulkCardInDOM(item);
    
    // Update progress HTML
    const percentage = Math.round((i / total) * 100);
    progressText.textContent = `Processing image ${i + 1} of ${total}: ${item.name}...`;
    progressPct.textContent = `${percentage}%`;
    progressFill.style.width = `${percentage}%`;

    // Await minor tick to allow DOM rendering thread updates
    await sleep(60);

    let tempUrl = null;
    try {
      // Load source image object from raw file using temporary object URL
      tempUrl = URL.createObjectURL(item.file);
      const img = await loadImageObject(tempUrl);
      
      // Revoke the object URL immediately to release resource pointer
      URL.revokeObjectURL(tempUrl);
      tempUrl = null;

      // Render to canvas applying visual filters & size adjustments
      const canvas = processImageToCanvas(img, currentFilters, transforms, sizeSettings, { enabled: microTweaksEnabled });
      
      let mimeType = 'image/jpeg';
      if (exportFormat === 'png') mimeType = 'image/png';
      else if (exportFormat === 'webp') mimeType = 'image/webp';

      let dataUrl = canvas.toDataURL(mimeType, exportQuality);

      // Inject metadata if JPEG
      if (exportFormat === 'jpeg' && injectExif) {
        const exifBytes = generateEXIFBytes();
        if (exifBytes) {
          try {
            dataUrl = piexif.insert(exifBytes, dataUrl);
          } catch(e) {
            console.error("EXIF injection failed in batch for: " + item.name, e);
          }
        }
      }

      // Convert to blob and add to Zip archive
      const blob = dataURLtoBlob(dataUrl);
      const outputFilename = generateFilename(item.name, i);
      zip.file(outputFilename, blob);

      item.status = 'success';
      updateBulkCardInDOM(item);
    } catch(err) {
      if (tempUrl) {
        URL.revokeObjectURL(tempUrl);
      }
      console.error("Failed to process queue image: " + item.name, err);
      item.status = 'pending'; // Reset state
      updateBulkCardInDOM(item);
    }
  }

  // Update progress to 100
  progressText.textContent = "Compiling ZIP file...";
  progressPct.textContent = "100%";
  progressFill.style.width = "100%";
  renderBulkQueue();
  await sleep(100);

  // Compile ZIP and save
  try {
    const zipBlob = await zip.generateAsync({ type: "blob" });
    triggerDownload(zipBlob, "smbify_anonymized_images.zip");
    logStatus("Bulk enhancement completed!");
  } catch (err) {
    console.error("ZIP Generation failed", err);
    logStatus("Bulk export failed compiling ZIP.");
  } finally {
    // Reset export view controls
    exportBtn.disabled = false;
    progressWrapper.classList.add('hidden');
    toggleExportButtonState();
  }
}

// UTILITY HELPERS
function toggleExportButtonState() {
  const exportBtn = document.getElementById('btn-export');
  if (state.mode === 'single') {
    exportBtn.disabled = !state.single.img;
  } else {
    exportBtn.disabled = state.bulk.queue.length === 0;
  }
}

function updateStatusDetails() {
  const details = document.getElementById('status-details');
  if (state.mode === 'single') {
    if (state.single.file) {
      details.innerHTML = `
        <span><strong>File:</strong> ${state.single.file.name}</span>
        <span><strong>Dimensions:</strong> ${state.single.currentWidth} x ${state.single.currentHeight} px</span>
      `;
    } else {
      details.innerHTML = `<span>No image loaded</span>`;
    }
  } else {
    details.innerHTML = `
      <span><strong>Mode:</strong> Bulk</span>
      <span><strong>Queue Count:</strong> ${state.bulk.queue.length} files</span>
    `;
  }
}

function logStatus(msg) {
  document.getElementById('status-message').textContent = msg;
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function dataURLtoBlob(dataurl) {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while(n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function loadImageObject(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Generate an optimized downscaled preview to load in DOM (prevents browser reflow & paint lag)
function updateDOMPreview(img) {
  const preview = document.getElementById('preview-image');
  if (!preview) return;

  const maxPreviewDim = 1200;
  let pw = img.naturalWidth || img.width;
  let ph = img.naturalHeight || img.height;
  
  if (pw > ph) {
    if (pw > maxPreviewDim) {
      ph = Math.round((ph * maxPreviewDim) / pw);
      pw = maxPreviewDim;
    }
  } else {
    if (ph > maxPreviewDim) {
      pw = Math.round((pw * maxPreviewDim) / ph);
      ph = maxPreviewDim;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = pw;
  canvas.height = ph;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, pw, ph);

  preview.src = canvas.toDataURL('image/jpeg', 0.85);
}
