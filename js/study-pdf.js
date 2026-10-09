// ==========================================
// SYNAPSE OS: PDF Study Manager
// ==========================================

class PDFStudyManager {
  constructor() {
    this.currentPdfId = null;
    this.pdfDoc = null;
    this.pageNum = 1;
    this.pageRendering = false;
    this.pageNumPending = null;
    this.scale = 1.25;
    this.splitNotesOpen = true;
    this.canvas = null;
    this.ctx = null;
  }

  init() {
    this.canvas = document.getElementById('pdf-canvas');
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
    }

    this.renderPdfList();
    this.bindEvents();

    // Select first PDF by default
    if (store.data.pdfs.length > 0) {
      this.selectPdf(store.data.pdfs[0].id);
    }
  }

  bindEvents() {
    // Page navigation
    const prevBtn = document.getElementById('btn-pdf-prev');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.onPrevPage());
    }

    const nextBtn = document.getElementById('btn-pdf-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.onNextPage());
    }

    const pageInput = document.getElementById('pdf-page-num');
    if (pageInput) {
      pageInput.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10);
        if (this.pdfDoc && val >= 1 && val <= this.pdfDoc.numPages) {
          this.queueRenderPage(val);
        }
      });
    }

    // Zoom controls
    const zoomInBtn = document.getElementById('btn-pdf-zoom-in');
    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => {
        this.scale = Math.min(this.scale + 0.2, 3.0);
        this.queueRenderPage(this.pageNum);
      });
    }

    const zoomOutBtn = document.getElementById('btn-pdf-zoom-out');
    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => {
        this.scale = Math.max(this.scale - 0.2, 0.6);
        this.queueRenderPage(this.pageNum);
      });
    }

    // Split-Screen Notes Toggle
    const toggleSplitBtn = document.getElementById('btn-pdf-toggle-notes');
    if (toggleSplitBtn) {
      toggleSplitBtn.addEventListener('click', () => {
        this.splitNotesOpen = !this.splitNotesOpen;
        const workspace = document.getElementById('pdf-viewer-workspace');
        if (workspace) {
          workspace.classList.toggle('single-pane', !this.splitNotesOpen);
        }
      });
    }

    // Split Notes Textarea Auto-save
    const splitNotesTextarea = document.getElementById('pdf-split-notes-textarea');
    if (splitNotesTextarea) {
      splitNotesTextarea.addEventListener('input', (e) => {
        const pdf = store.data.pdfs.find(p => p.id === this.currentPdfId);
        if (pdf) {
          pdf.notes = e.target.value;
          store.saveData();
        }
      });
    }

    // Drag and Drop Upload
    const dropZone = document.getElementById('pdf-drop-zone');
    const fileInput = document.getElementById('pdf-file-input');

    if (dropZone && fileInput) {
      dropZone.addEventListener('click', () => fileInput.click());

      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
      });

      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          this.handleFileUpload(e.dataTransfer.files[0]);
        }
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.handleFileUpload(e.target.files[0]);
        }
      });
    }

    // Fit Width and Fit Page Controls
    const fitWidthBtn = document.getElementById('btn-pdf-fit-width');
    if (fitWidthBtn) {
      fitWidthBtn.addEventListener('click', () => this.fitToWidth());
    }

    const fitPageBtn = document.getElementById('btn-pdf-fit-page');
    if (fitPageBtn) {
      fitPageBtn.addEventListener('click', () => this.fitToPage());
    }

    // Toggle Documents Sidebar
    const toggleSidebarBtn = document.getElementById('btn-pdf-toggle-sidebar');
    if (toggleSidebarBtn) {
      toggleSidebarBtn.addEventListener('click', () => this.toggleSidebar());
    }

    // Initialize Draggable Resizers (Sidebar & Split Notes)
    this.initResizers();

    // Auto-adjust on window resize
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const activeSub = document.querySelector('.study-subview.active');
        if (activeSub && activeSub.id === 'study-view-pdf' && this.pdfDoc) {
          this.queueRenderPage(this.pageNum);
        }
      }, 200);
    });
  }

  renderPdfList() {
    const container = document.getElementById('pdf-items-list');
    if (!container) return;

    container.innerHTML = store.data.pdfs.map(pdf => {
      const isSelected = pdf.id === this.currentPdfId;
      const subject = store.data.subjects.find(s => s.id === pdf.subjectId);

      return `
        <div class="pdf-item-card ${isSelected ? 'active' : ''}" data-id="${pdf.id}">
          <div class="pdf-card-title">📄 ${pdf.title}</div>
          <div class="pdf-card-meta">
            <span style="color: ${subject ? subject.color : 'inherit'}; font-weight: 500;">
              ${subject ? subject.name : 'General'}
            </span>
            <span>Page ${pdf.lastReadPage || 1} / ${pdf.totalPages || '?'}</span>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.pdf-item-card').forEach(el => {
      el.addEventListener('click', () => {
        this.selectPdf(el.dataset.id);
      });
    });
  }

  selectPdf(pdfId) {
    this.currentPdfId = pdfId;
    const pdf = store.data.pdfs.find(p => p.id === pdfId);
    if (!pdf) return;

    this.renderPdfList();

    // Update Split Notes pane
    const splitNotesTextarea = document.getElementById('pdf-split-notes-textarea');
    const currentPdfTitle = document.getElementById('pdf-current-doc-title');
    if (splitNotesTextarea) {
      splitNotesTextarea.value = pdf.notes || '';
    }
    if (currentPdfTitle) {
      currentPdfTitle.textContent = pdf.title;
    }

    this.pageNum = pdf.lastReadPage || 1;

    // Load PDF via PDF.js if available
    this.loadPdfDocument(pdf);
  }

  loadPdfDocument(pdf) {
    if (typeof pdfjsLib === 'undefined') {
      console.warn('PDF.js not loaded, using embedded fallback');
      this.renderFallbackViewer(pdf);
      return;
    }

    // Set worker src
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    const urlOrData = pdf.dataUrl || pdf.filePath || 'assets/sample_study_guide.pdf';

    const loadingTask = pdfjsLib.getDocument(urlOrData);
    loadingTask.promise.then((pdfDoc) => {
      this.pdfDoc = pdfDoc;
      const totalPagesEl = document.getElementById('pdf-page-count');
      if (totalPagesEl) totalPagesEl.textContent = pdfDoc.numPages;
      
      pdf.totalPages = pdfDoc.numPages;
      store.saveData();

      this.renderPage(this.pageNum);
    }).catch((err) => {
      console.error('Error loading PDF with PDF.js:', err);
      this.renderFallbackViewer(pdf);
    });
  }

  renderPage(num) {
    this.pageRendering = true;
    if (!this.pdfDoc) return;

    this.pdfDoc.getPage(num).then((page) => {
      const viewport = page.getViewport({ scale: this.scale });
      this.canvas.height = viewport.height;
      this.canvas.width = viewport.width;

      const renderContext = {
        canvasContext: this.ctx,
        viewport: viewport
      };

      const renderTask = page.render(renderContext);

      renderTask.promise.then(() => {
        this.pageRendering = false;
        if (this.pageNumPending !== null) {
          this.renderPage(this.pageNumPending);
          this.pageNumPending = null;
        }
      });
    });

    // Update page counters
    const pageNumInput = document.getElementById('pdf-page-num');
    if (pageNumInput) pageNumInput.value = num;

    const pdf = store.data.pdfs.find(p => p.id === this.currentPdfId);
    if (pdf) {
      pdf.lastReadPage = num;
      store.saveData();
    }
  }

  queueRenderPage(num) {
    if (this.pageRendering) {
      this.pageNumPending = num;
    } else {
      this.pageNum = num;
      this.renderPage(num);
    }
  }

  onPrevPage() {
    if (this.pageNum <= 1) return;
    this.pageNum--;
    this.queueRenderPage(this.pageNum);
  }

  onNextPage() {
    if (!this.pdfDoc || this.pageNum >= this.pdfDoc.numPages) return;
    this.pageNum++;
    this.queueRenderPage(this.pageNum);
  }

  renderFallbackViewer(pdf) {
    const container = document.getElementById('pdf-canvas-container');
    if (!container) return;

    container.innerHTML = `
      <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #0b0f1a; padding: 2rem; border-radius: var(--radius-lg); text-align: center;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">📄</div>
        <h3 style="margin-bottom: 0.5rem;">${pdf.title}</h3>
        <p style="color: var(--text-secondary); max-width: 480px; font-size: 0.88rem; margin-bottom: 1.5rem;">
          Embedded PDF reader active. You can read, highlight, and write your study notes on the right side without switching windows.
        </p>
        <iframe src="${pdf.dataUrl || pdf.filePath || 'assets/sample_study_guide.pdf'}" style="width: 100%; height: 500px; border: 1px solid var(--border-subtle); border-radius: var(--radius-md);"></iframe>
      </div>
    `;
  }

  handleFileUpload(file) {
    if (file.type !== 'application/pdf') {
      alert('Please upload a valid PDF document.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      let serverFilePath = null;

      try {
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            dataUrl: dataUrl
          })
        });
        const uploadData = await uploadRes.json();
        if (uploadData.success) {
          serverFilePath = uploadData.url;
        }
      } catch (err) {
        console.warn('Backend upload skipped, using local dataUrl:', err);
      }

      const newPdf = {
        id: 'pdf-' + Date.now(),
        subjectId: store.data.subjects[0]?.id || 'subj-1',
        title: file.name.replace('.pdf', ''),
        fileName: file.name,
        dataUrl: dataUrl,
        filePath: serverFilePath || null,
        totalPages: 1,
        lastReadPage: 1,
        tags: ["LectureNotes"],
        notes: `Study notes for ${file.name}`
      };

      store.data.pdfs.unshift(newPdf);
      store.saveData();
      this.renderPdfList();
      this.selectPdf(newPdf.id);
      showToast(`📄 Added "${newPdf.title}" to library`, 'success');
    };
    reader.readAsDataURL(file);
  }

  // --- RESIZING & RESPONSIVE LAYOUT ENGINE ---
  fitToWidth() {
    if (!this.pdfDoc) return;
    this.pdfDoc.getPage(this.pageNum).then(page => {
      const container = document.getElementById('pdf-canvas-container');
      if (!container) return;
      const availableWidth = Math.max(300, container.clientWidth - 48);
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      this.scale = Math.max(0.4, Math.min(3.5, availableWidth / unscaledViewport.width));
      this.queueRenderPage(this.pageNum);
      showToast(`↔ Fit Width: ${Math.round(this.scale * 100)}%`, 'info');
    });
  }

  fitToPage() {
    if (!this.pdfDoc) return;
    this.pdfDoc.getPage(this.pageNum).then(page => {
      const container = document.getElementById('pdf-canvas-container');
      if (!container) return;
      const availableHeight = Math.max(300, container.clientHeight - 48);
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      this.scale = Math.max(0.4, Math.min(3.0, availableHeight / unscaledViewport.height));
      this.queueRenderPage(this.pageNum);
      showToast(`↕ Fit Page: ${Math.round(this.scale * 100)}%`, 'info');
    });
  }

  toggleSidebar() {
    const sidebar = document.getElementById('pdf-sidebar-pane');
    if (!sidebar) return;

    const isCollapsed = sidebar.classList.toggle('collapsed');
    if (isCollapsed) {
      sidebar.dataset.prevWidth = sidebar.style.width || '270px';
      sidebar.style.display = 'none';
      showToast('Documents sidebar collapsed', 'info');
    } else {
      sidebar.style.display = 'flex';
      sidebar.style.width = sidebar.dataset.prevWidth || '270px';
      showToast('Documents sidebar opened', 'info');
    }

    setTimeout(() => {
      if (this.pdfDoc) this.queueRenderPage(this.pageNum);
    }, 150);
  }

  initResizers() {
    // 1. Sidebar Resizer (Horizontal Draggable Splitter)
    const resizerSidebar = document.getElementById('pdf-resizer-sidebar');
    const sidebar = document.getElementById('pdf-sidebar-pane');
    const container = document.getElementById('pdf-workspace-container');

    if (resizerSidebar && sidebar && container) {
      const savedSidebarWidth = localStorage.getItem('synapse_pdf_sidebar_width');
      if (savedSidebarWidth && window.innerWidth > 900) {
        sidebar.style.width = `${savedSidebarWidth}px`;
      }

      let isDraggingSidebar = false;

      const onMouseDownSidebar = (e) => {
        isDraggingSidebar = true;
        document.body.classList.add('resizing-col');
        resizerSidebar.classList.add('active');
        e.preventDefault();
      };

      const onMouseMoveSidebar = (e) => {
        if (!isDraggingSidebar) return;
        const containerRect = container.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const newWidth = Math.max(180, Math.min(460, clientX - containerRect.left));
        sidebar.style.width = `${newWidth}px`;
        localStorage.setItem('synapse_pdf_sidebar_width', newWidth);
      };

      const onMouseUpSidebar = () => {
        if (isDraggingSidebar) {
          isDraggingSidebar = false;
          document.body.classList.remove('resizing-col');
          resizerSidebar.classList.remove('active');
          if (this.pdfDoc) this.queueRenderPage(this.pageNum);
        }
      };

      resizerSidebar.addEventListener('mousedown', onMouseDownSidebar);
      resizerSidebar.addEventListener('touchstart', onMouseDownSidebar, { passive: false });
      window.addEventListener('mousemove', onMouseMoveSidebar);
      window.addEventListener('touchmove', onMouseMoveSidebar, { passive: false });
      window.addEventListener('mouseup', onMouseUpSidebar);
      window.addEventListener('touchend', onMouseUpSidebar);
    }

    // 2. Notes Pane Resizer (Vertical Draggable Splitter)
    const resizerNotes = document.getElementById('pdf-resizer-notes');
    const notesPane = document.getElementById('pdf-split-notes-pane');
    const workspace = document.getElementById('pdf-viewer-workspace');

    if (resizerNotes && notesPane && workspace) {
      const savedNotesWidth = localStorage.getItem('synapse_pdf_notes_width');
      if (savedNotesWidth && window.innerWidth > 900) {
        notesPane.style.width = `${savedNotesWidth}px`;
      }

      let isDraggingNotes = false;

      const onMouseDownNotes = (e) => {
        isDraggingNotes = true;
        document.body.classList.add('resizing-col');
        resizerNotes.classList.add('active');
        e.preventDefault();
      };

      const onMouseMoveNotes = (e) => {
        if (!isDraggingNotes) return;
        const workspaceRect = workspace.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const newWidth = Math.max(200, Math.min(600, workspaceRect.right - clientX));
        notesPane.style.width = `${newWidth}px`;
        localStorage.setItem('synapse_pdf_notes_width', newWidth);
      };

      const onMouseUpNotes = () => {
        if (isDraggingNotes) {
          isDraggingNotes = false;
          document.body.classList.remove('resizing-col');
          resizerNotes.classList.remove('active');
          if (this.pdfDoc) this.queueRenderPage(this.pageNum);
        }
      };

      resizerNotes.addEventListener('mousedown', onMouseDownNotes);
      resizerNotes.addEventListener('touchstart', onMouseDownNotes, { passive: false });
      window.addEventListener('mousemove', onMouseMoveNotes);
      window.addEventListener('touchmove', onMouseMoveNotes, { passive: false });
      window.addEventListener('mouseup', onMouseUpNotes);
      window.addEventListener('touchend', onMouseUpNotes);
    }
  }
}

const pdfManager = new PDFStudyManager();
