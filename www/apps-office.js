(function () {
  'use strict';

  const KEYS = {
    WORD_DOCS: 'w11_office_word_docs_v1',
    EXCEL_SHEETS: 'w11_office_excel_v1',
    PPT_DECKS: 'w11_office_ppt_v1',
    PAINT_DATA: 'w11_office_paint_v1',
    CODE_TABS: 'w11_code_studio_v1'
  };

  function readStore(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeStore(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      console.warn('Storage write warning:', e);
    }
  }

  function escHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escXml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 250);
  }

  // =========================================================================
  // REAL OOXML .DOCX IMPORT & EXPORT (JSZip + DOMParser)
  // =========================================================================
  async function importDocxArrayBuffer(arrayBuffer) {
    if (!window.JSZip) throw new Error('JSZip offline bundle not loaded');
    const zip = await window.JSZip.loadAsync(arrayBuffer);
    const docEntry = zip.file('word/document.xml');
    if (!docEntry) throw new Error('Invalid .docx archive (missing word/document.xml)');
    const xmlText = await docEntry.async('text');
    const xml = new DOMParser().parseFromString(xmlText, 'application/xml');

    const byTag = (root, name) => Array.from(root.getElementsByTagNameNS('*', name));
    const paragraphs = byTag(xml, 'p');
    const blocks = [];

    for (const p of paragraphs) {
      let tag = 'p';
      const pStyle = byTag(p, 'pStyle')[0];
      const styleVal = (pStyle?.getAttribute('w:val') || pStyle?.getAttribute('val') || '').toLowerCase();
      if (styleVal.includes('heading1') || styleVal === 'title') tag = 'h1';
      else if (styleVal.includes('heading2') || styleVal === 'subtitle') tag = 'h2';

      const runs = byTag(p, 'r');
      let inner = '';
      for (const r of runs) {
        const texts = byTag(r, 't').map((t) => escHtml(t.textContent || '')).join('');
        if (!texts) continue;
        const rPr = byTag(r, 'rPr')[0];
        let chunk = texts;
        if (rPr) {
          if (byTag(rPr, 'b').length) chunk = `<b>${chunk}</b>`;
          if (byTag(rPr, 'i').length) chunk = `<i>${chunk}</i>`;
          if (byTag(rPr, 'u').length) chunk = `<u>${chunk}</u>`;
        }
        inner += chunk;
      }
      blocks.push(`<${tag}>${inner || '<br>'}</${tag}>`);
    }
    return blocks.join('\n') || '<p></p>';
  }

  async function exportDocxBlob(htmlContent) {
    if (!window.JSZip) throw new Error('JSZip offline bundle not loaded');
    const holder = document.createElement('div');
    holder.innerHTML = htmlContent;

    const wParagraphs = [];
    function collectRuns(node, state, outRuns) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.nodeValue || '';
        if (text) {
          const rPr = [];
          if (state.b) rPr.push('<w:b/>');
          if (state.i) rPr.push('<w:i/>');
          if (state.u) rPr.push('<w:u w:val="single"/>');
          if (state.size) rPr.push(`<w:sz w:val="${state.size}"/><w:szCs w:val="${state.size}"/>`);
          const rPrXml = rPr.length ? `<w:rPr>${rPr.join('')}</w:rPr>` : '';
          outRuns.push(`<w:r>${rPrXml}<w:t xml:space="preserve">${escXml(text)}</w:t></w:r>`);
        }
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.tagName.toUpperCase();
      if (tag === 'BR') {
        outRuns.push('<w:r><w:br/></w:r>');
        return;
      }
      const next = {
        b: state.b || tag === 'B' || tag === 'STRONG' || tag === 'H1' || tag === 'H2',
        i: state.i || tag === 'I' || tag === 'EM',
        u: state.u || tag === 'U',
        size: tag === 'H1' ? 36 : tag === 'H2' ? 28 : state.size
      };
      for (const child of node.childNodes) {
        collectRuns(child, next, outRuns);
      }
    }

    const children = holder.childNodes.length ? Array.from(holder.childNodes) : [];
    if (!children.length) {
      wParagraphs.push('<w:p><w:r><w:t></w:t></w:r></w:p>');
    } else {
      for (const node of children) {
        if (node.nodeType === Node.ELEMENT_NODE && (node.tagName === 'UL' || node.tagName === 'OL')) {
          const items = Array.from(node.querySelectorAll('li'));
          items.forEach((li, idx) => {
            const runs = [];
            const prefix = node.tagName === 'OL' ? `${idx + 1}. ` : '• ';
            runs.push(`<w:r><w:t xml:space="preserve">${escXml(prefix)}</w:t></w:r>`);
            collectRuns(li, { b: false, i: false, u: false, size: 22 }, runs);
            wParagraphs.push(`<w:p>${runs.join('')}</w:p>`);
          });
        } else {
          const tag = node.nodeType === Node.ELEMENT_NODE ? node.tagName.toUpperCase() : 'P';
          const runs = [];
          collectRuns(node, { b: tag === 'H1' || tag === 'H2', i: false, u: false, size: tag === 'H1' ? 36 : tag === 'H2' ? 28 : 22 }, runs);
          wParagraphs.push(`<w:p>${runs.join('')}</w:p>`);
        }
      }
    }

    const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

    const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${wParagraphs.join('\n    ')}
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>`;

    const zip = new window.JSZip();
    zip.file('[Content_Types].xml', contentTypesXml);
    zip.folder('_rels').file('.rels', relsXml);
    zip.folder('word').file('document.xml', documentXml);
    return await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
  }

  // =========================================================================
  // REAL OOXML .PPTX IMPORT & EXPORT (JSZip + DOMParser)
  // =========================================================================
  async function importPptxArrayBuffer(arrayBuffer) {
    if (!window.JSZip) throw new Error('JSZip offline bundle not loaded');
    const zip = await window.JSZip.loadAsync(arrayBuffer);
    const slidePaths = Object.keys(zip.files)
      .filter((p) => /^ppt\/slides\/slide\d+\.xml$/i.test(p))
      .sort((a, b) => {
        const na = parseInt(a.match(/(\d+)\.xml$/i)[1], 10);
        const nb = parseInt(b.match(/(\d+)\.xml$/i)[1], 10);
        return na - nb;
      });

    if (!slidePaths.length) throw new Error('Invalid .pptx file (no slides found)');
    const byTag = (root, name) => Array.from(root.getElementsByTagNameNS('*', name));
    const slides = [];

    for (let i = 0; i < slidePaths.length; i++) {
      const xmlStr = await zip.file(slidePaths[i]).async('text');
      const xml = new DOMParser().parseFromString(xmlStr, 'application/xml');
      const shapes = byTag(xml, 'sp');

      let title = '';
      let subtitle = '';
      const bodyLines = [];
      const fallbackTexts = [];

      for (const sp of shapes) {
        const paras = byTag(sp, 'p')
          .map((p) => byTag(p, 't').map((t) => t.textContent || '').join('').trim())
          .filter(Boolean);
        if (!paras.length) continue;

        const ph = byTag(sp, 'ph')[0];
        const phType = (ph?.getAttribute('type') || '').toLowerCase();
        if (phType === 'title' || phType === 'ctrtitle') {
          title = paras.join(' ');
        } else if (phType === 'subtitle') {
          subtitle = paras.join(' ');
        } else if (phType === 'body' || phType === 'obj') {
          bodyLines.push(...paras);
        } else {
          fallbackTexts.push(paras);
        }
      }

      if (!title && fallbackTexts.length) {
        title = fallbackTexts.shift().join(' ');
      }
      if (!subtitle && fallbackTexts.length > 1) {
        subtitle = fallbackTexts.shift().join(' ');
      }
      for (const rem of fallbackTexts) {
        bodyLines.push(...rem);
      }

      slides.push({
        title: title || `Slide ${i + 1}`,
        subtitle,
        body: bodyLines.join('\n'),
        notes: ''
      });
    }

    return slides;
  }

  async function exportPptxBlob(deck) {
    if (!window.JSZip) throw new Error('JSZip offline bundle not loaded');
    const slides = deck.slides && deck.slides.length ? deck.slides : [{ title: 'Slide 1', subtitle: '', body: '' }];
    const themeColors = {
      aurora: { bg: '071E3D', fg: 'F8FAFC', sub: '7DD3FC' },
      fluent: { bg: '173B8F', fg: 'F8FAFC', sub: 'BFDBFE' },
      crimson: { bg: '5C1616', fg: 'F8FAFC', sub: 'FECACA' },
      light: { bg: 'F8FAFC', fg: '0F172A', sub: '334155' }
    };
    const pal = themeColors[deck.theme] || themeColors.aurora;
    const zip = new window.JSZip();

    const slideOverrides = slides
      .map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`)
      .join('\n  ');

    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  ${slideOverrides}
</Types>`);

    zip.folder('_rels').file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`);

    const sldIdList = slides
      .map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`)
      .join('\n    ');

    zip.folder('ppt').file('presentation.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>
    ${sldIdList}
  </p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`);

    const presRels = slides
      .map((_, i) => `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`)
      .join('\n  ');

    zip.folder('ppt').folder('_rels').file('presentation.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  ${presRels}
</Relationships>`);

    zip.folder('ppt').folder('slideMasters').file('slideMaster1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>`);

    zip.folder('ppt').folder('slideMasters').folder('_rels').file('slideMaster1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`);

    zip.folder('ppt').folder('slideLayouts').file('slideLayout1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
</p:sldLayout>`);

    zip.folder('ppt').folder('slideLayouts').folder('_rels').file('slideLayout1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`);

    zip.folder('ppt').folder('theme').file('theme1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="AuroraTheme">
  <a:themeElements>
    <a:clrScheme name="Aurora">
      <a:dk1><a:srgbClr val="0F172A"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="1E293B"/></a:dk2><a:lt2><a:srgbClr val="F1F5F9"/></a:lt2>
      <a:accent1><a:srgbClr val="2563EB"/></a:accent1><a:accent2><a:srgbClr val="10B981"/></a:accent2>
      <a:accent3><a:srgbClr val="F59E0B"/></a:accent3><a:accent4><a:srgbClr val="8B5CF6"/></a:accent4>
      <a:accent5><a:srgbClr val="EC4899"/></a:accent5><a:accent6><a:srgbClr val="06B6D4"/></a:accent6>
      <a:hlink><a:srgbClr val="38BDF8"/></a:hlink><a:folHlink><a:srgbClr val="818CF8"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Fluent">
      <a:majorFont><a:latin typeface="Segoe UI"/></a:majorFont>
      <a:minorFont><a:latin typeface="Segoe UI"/></a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="FluentFmt">
      <a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>
      <a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>
      <a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
      <a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
</a:theme>`);

    const slidesDir = zip.folder('ppt').folder('slides');
    const slideRelsDir = slidesDir.folder('_rels');

    slides.forEach((sl, idx) => {
      const n = idx + 1;
      const bodyParas = (sl.body || '')
        .split(/\r?\n/)
        .map((line) => `<a:p><a:r><a:rPr lang="en-US" sz="2000"><a:solidFill><a:srgbClr val="${pal.fg}"/></a:solidFill></a:rPr><a:t>${escXml(line)}</a:t></a:r></a:p>`)
        .join('\n          ');

      slidesDir.file(`slide${n}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg><p:bgPr><a:solidFill><a:srgbClr val="${pal.bg}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="685800" y="457200"/><a:ext cx="10820400" cy="1143000"/></a:xfrm></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/>
          <a:p><a:r><a:rPr lang="en-US" sz="3600" b="1"><a:solidFill><a:srgbClr val="${pal.fg}"/></a:solidFill></a:rPr><a:t>${escXml(sl.title || '')}</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Subtitle"/><p:cNvSpPr/><p:nvPr><p:ph type="subTitle"/></p:nvPr></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="685800" y="1645920"/><a:ext cx="10820400" cy="685800"/></a:xfrm></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/>
          <a:p><a:r><a:rPr lang="en-US" sz="2000"><a:solidFill><a:srgbClr val="${pal.sub}"/></a:solidFill></a:rPr><a:t>${escXml(sl.subtitle || '')}</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="4" name="Content"/><p:cNvSpPr/><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="685800" y="2514600"/><a:ext cx="10820400" cy="3657600"/></a:xfrm></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/>
          ${bodyParas || '<a:p><a:endParaRPr lang="en-US"/></a:p>'}
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`);

      slideRelsDir.file(`slide${n}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`);
    });

    return await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    });
  }

  // =========================================================================
  // SEED DEFAULT FILES ON FIRST RUN
  // =========================================================================
  if (!localStorage.getItem(KEYS.WORD_DOCS)) {
    writeStore(KEYS.WORD_DOCS, [
      {
        id: 'doc-welcome',
        title: 'AuroraOS Project Notes.docx',
        updated: new Date().toLocaleDateString(),
        html: '<h1>AuroraOS — Desktop Workspace</h1><p>Welcome to <b>Microsoft Word</b> with native <b>.docx</b> import and export running offline inside AuroraOS Win11.</p><ul><li>Open real .docx files from your phone storage</li><li>Format headings, bold, italic, underline, lists, and alignment</li><li>Export genuine .docx files compatible with Word &amp; Google Docs</li></ul>'
      }
    ]);
  }

  if (!localStorage.getItem(KEYS.EXCEL_SHEETS)) {
    writeStore(KEYS.EXCEL_SHEETS, {
      name: 'Budget_Tracker.xlsx',
      rows: 26,
      cols: 10,
      cells: {
        A1: 'Item', B1: 'Cost', C1: 'Qty', D1: 'Total',
        A2: 'Starlink Mini', B2: '599', C2: '1', D2: '=B2*C2',
        A3: 'Mesh Node', B3: '89', C3: '2', D3: '=B3*C3',
        A4: '12V Harness', B4: '34.50', C4: '1', D4: '=B4*C4',
        A5: 'Grand Total', D5: '=SUM(D2:D4)'
      }
    });
  }

  if (!localStorage.getItem(KEYS.PPT_DECKS)) {
    writeStore(KEYS.PPT_DECKS, {
      name: 'AuroraOS_Overview.pptx',
      theme: 'aurora',
      slides: [
        {
          title: 'AuroraOS Win11',
          subtitle: 'Mobile Edge Desktop Environment • Built by Jeramy Adams',
          body: '• Full Windows 11 Start Menu, Taskbar & Snap Layouts\n• Native .docx, .xlsx & .pptx import/export offline\n• Built-in Microsoft Paint & Code Studio IDE',
          notes: 'Opening title slide.'
        },
        {
          title: 'Built-In Productivity & Dev Tools',
          subtitle: 'Word • Excel • PowerPoint • Paint • Code Studio',
          body: '• Import & export real .docx, .xlsx, and .pptx files\n• Sketch diagrams in Paint or preview HTML/JS in Code Studio\n• Snap windows side-by-side or top/bottom on mobile',
          notes: 'Highlight offline capabilities.'
        }
      ]
    });
  }

  if (!localStorage.getItem(KEYS.CODE_TABS)) {
    writeStore(KEYS.CODE_TABS, {
      activeId: 'tab-html',
      tabs: [
        {
          id: 'tab-html',
          name: 'widget.html',
          lang: 'HTML',
          code: '<!DOCTYPE html>\n<html>\n<body style="margin:0;padding:24px;font-family:system-ui;background:#071e3d;color:#f8fafc;">\n  <h2 style="margin:0 0 8px;color:#38bdf8;">AuroraOS Live Widget</h2>\n  <p>Edit this HTML/CSS/JS and click <b>Run Preview</b>!</p>\n  <button onclick="document.getElementById(\'out\').textContent=new Date().toLocaleTimeString()" style="padding:8px 14px;border:0;border-radius:8px;background:#2563eb;color:#fff;font-weight:700;">Check Clock</button>\n  <div id="out" style="margin-top:12px;font-size:20px;font-weight:700;color:#34d399;"></div>\n</body>\n</html>'
        },
        {
          id: 'tab-sh',
          name: 'sync_backup.sh',
          lang: 'Bash',
          code: '#!/usr/bin/env bash\nset -euo pipefail\necho "AuroraOS Termux Sync Ready"\ndate\n'
        },
        {
          id: 'tab-py',
          name: 'cortex_ping.py',
          lang: 'Python',
          code: 'import sqlite3, json\nprint(json.dumps({"node": "AuroraOS-Win11", "status": "online"}))\n'
        }
      ]
    });
  }

  // =========================================================================
  // FLUENT UI, TASKBAR, START MENU, SNAP & RESIZE STYLES
  // =========================================================================
  const style = document.createElement('style');
  style.textContent = `
    #w11-icon-column {
      position: fixed;
      top: calc(max(16px, env(safe-area-inset-top)) + 86px);
      left: 14px;
      z-index: 5;
      display: grid;
      grid-template-columns: repeat(2, 76px);
      gap: 6px 4px;
      pointer-events: none;
    }
    .w11-desk-app {
      pointer-events: auto;
      width: 76px;
      padding: 7px 4px;
      border-radius: 6px;
      border: 1px solid transparent;
      background: transparent;
      color: #fff;
      text-align: center;
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
      touch-action: manipulation;
      transition: background 0.14s ease, border-color 0.14s ease;
    }
    .w11-desk-app:hover, .w11-desk-app:active {
      background: rgba(255, 255, 255, 0.14);
      border-color: rgba(255, 255, 255, 0.25);
      backdrop-filter: blur(6px);
    }
    .w11-desk-app span {
      display: block;
      margin-top: 3px;
      font: 500 11px/1.18 system-ui, -apple-system, sans-serif;
      text-shadow: 0 1px 3px rgba(0,0,0,0.92), 0 0 6px rgba(0,0,0,0.7);
      word-break: break-word;
    }

    /* Windows 11 Bottom Taskbar */
    #w11-taskbar {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      padding-bottom: env(safe-area-inset-bottom);
      height: calc(48px + env(safe-area-inset-bottom));
      z-index: 10050;
      background: rgba(20, 23, 31, 0.86);
      backdrop-filter: blur(26px) saturate(160%);
      -webkit-backdrop-filter: blur(26px) saturate(160%);
      border-top: 1px solid rgba(255, 255, 255, 0.14);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-left: 10px;
      padding-right: 10px;
      box-sizing: border-box;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .w11-tb-left {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }
    .w11-tb-center {
      display: flex;
      align-items: center;
      gap: 4px;
      overflow-x: auto;
      scrollbar-width: none;
      padding: 2px 4px;
    }
    .w11-tb-center::-webkit-scrollbar { display: none; }
    .w11-tb-btn {
      position: relative;
      width: 38px;
      height: 38px;
      border-radius: 7px;
      border: 1px solid transparent;
      background: transparent;
      color: #f8fafc;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.14s ease, transform 0.1s ease;
    }
    .w11-tb-btn:hover, .w11-tb-btn.active {
      background: rgba(255, 255, 255, 0.12);
      border-color: rgba(255, 255, 255, 0.14);
    }
    .w11-tb-btn:active { transform: scale(0.92); }
    .w11-tb-btn.running::after {
      content: '';
      position: absolute;
      bottom: 2px;
      width: 6px;
      height: 3px;
      border-radius: 99px;
      background: #94a3b8;
      transition: width 0.16s ease, background 0.16s ease;
    }
    .w11-tb-btn.focused::after {
      width: 16px;
      background: #38bdf8;
    }
    .w11-tb-search-pill {
      height: 32px;
      padding: 0 11px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.16);
      background: rgba(255, 255, 255, 0.08);
      color: #cbd5e1;
      font-size: 12px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      white-space: nowrap;
    }
    .w11-tb-search-pill:hover { background: rgba(255, 255, 255, 0.14); }
    .w11-tb-tray {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
    .w11-tray-pill {
      height: 36px;
      padding: 0 8px;
      border-radius: 7px;
      border: 0;
      background: transparent;
      color: #f1f5f9;
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      font-size: 11px;
    }
    .w11-tray-pill:hover { background: rgba(255, 255, 255, 0.1); }
    .w11-clock {
      text-align: right;
      line-height: 1.2;
      font-size: 11px;
      font-weight: 500;
      color: #f8fafc;
    }

    /* Windows 11 Start Menu */
    #w11-start-menu {
      display: none;
      position: fixed;
      left: 50%;
      bottom: calc(56px + env(safe-area-inset-bottom));
      transform: translateX(-50%);
      width: min(520px, calc(100vw - 16px));
      max-height: calc(100vh - 80px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
      z-index: 10040;
      background: rgba(24, 27, 36, 0.94);
      backdrop-filter: blur(32px) saturate(170%);
      -webkit-backdrop-filter: blur(32px) saturate(170%);
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 14px;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.72);
      color: #f8fafc;
      font-family: system-ui, -apple-system, sans-serif;
      flex-direction: column;
      overflow: hidden;
    }
    .w11-sm-body {
      padding: 16px 18px 12px;
      overflow-y: auto;
      flex: 1;
    }
    .w11-sm-search {
      width: 100%;
      box-sizing: border-box;
      background: rgba(15, 18, 25, 0.85);
      border: 1px solid rgba(56, 189, 248, 0.45);
      border-radius: 999px;
      padding: 9px 15px;
      color: #f8fafc;
      font-size: 13px;
      outline: none;
      margin-bottom: 14px;
    }
    .w11-sm-sec-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      font-weight: 700;
      color: #e2e8f0;
      margin-bottom: 10px;
    }
    .w11-sm-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 16px;
    }
    @media (min-width: 480px) {
      .w11-sm-grid { grid-template-columns: repeat(5, 1fr); }
    }
    .w11-sm-tile {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid transparent;
      border-radius: 9px;
      padding: 9px 4px;
      color: #f8fafc;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 500;
      text-align: center;
    }
    .w11-sm-tile:hover, .w11-sm-tile:active {
      background: rgba(255, 255, 255, 0.12);
      border-color: rgba(255, 255, 255, 0.16);
    }
    .w11-sm-rec-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
      gap: 6px;
    }
    .w11-sm-rec-item {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 7px 9px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.04);
      cursor: pointer;
      text-align: left;
      border: 0;
      color: #f1f5f9;
    }
    .w11-sm-rec-item:hover { background: rgba(255, 255, 255, 0.11); }
    .w11-sm-footer {
      background: rgba(15, 17, 24, 0.85);
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      padding: 10px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    .w11-sm-user {
      display: flex;
      align-items: center;
      gap: 9px;
      font-size: 12.5px;
      font-weight: 600;
    }
    .w11-sm-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: linear-gradient(135deg, #38bdf8, #2563eb);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 12px;
      color: #fff;
    }

    /* Quick Settings Flyout */
    #w11-quick-settings {
      display: none;
      position: fixed;
      right: 10px;
      bottom: calc(56px + env(safe-area-inset-bottom));
      width: 270px;
      z-index: 10045;
      background: rgba(24, 27, 36, 0.94);
      backdrop-filter: blur(26px);
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 12px;
      padding: 14px;
      color: #f8fafc;
      font-family: system-ui, -apple-system, sans-serif;
      box-shadow: 0 18px 44px rgba(0, 0, 0, 0.65);
    }

    /* Snap Ghost Overlay */
    #w11-snap-ghost {
      display: none;
      position: fixed;
      z-index: 9999;
      background: rgba(56, 189, 248, 0.22);
      border: 2px solid rgba(56, 189, 248, 0.8);
      border-radius: 12px;
      backdrop-filter: blur(8px);
      pointer-events: none;
      transition: all 0.12s ease;
    }

    /* App Windows + Resize Handles + Snap Picker */
    .w11-app-win {
      position: fixed;
      top: 44px;
      left: 16px;
      width: min(780px, calc(100vw - 32px));
      height: min(520px, calc(100vh - 110px - env(safe-area-inset-bottom)));
      background: #181a20;
      color: #f1f5f9;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 12px;
      box-shadow: 0 22px 60px rgba(0, 0, 0, 0.72);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .w11-app-win.maximized {
      top: max(0px, env(safe-area-inset-top)) !important;
      left: 0 !important;
      width: 100vw !important;
      height: calc(100vh - 48px - max(0px, env(safe-area-inset-top)) - env(safe-area-inset-bottom)) !important;
      border-radius: 0;
    }
    .w11-app-win.snapped {
      border-radius: 0;
    }
    .w11-win-bar {
      position: relative;
      height: 38px;
      background: rgba(32, 35, 44, 0.96);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 8px 0 12px;
      cursor: move;
      user-select: none;
      -webkit-user-select: none;
      flex-shrink: 0;
    }
    .w11-win-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .w11-win-ctrls { display: flex; gap: 3px; align-items: center; }
    .w11-win-ctrls button {
      width: 30px;
      height: 26px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: #e2e8f0;
      font-size: 13px;
      cursor: pointer;
    }
    .w11-win-ctrls button:hover { background: rgba(255,255,255,0.12); }
    .w11-win-ctrls button.cls:hover { background: #dc2626; color: #fff; }
    .w11-snap-menu {
      display: none;
      position: absolute;
      top: 38px;
      right: 36px;
      z-index: 50;
      background: rgba(26, 30, 40, 0.98);
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 10px;
      padding: 8px;
      box-shadow: 0 14px 36px rgba(0, 0, 0, 0.65);
      grid-template-columns: repeat(2, 68px);
      gap: 6px;
    }
    .w11-snap-opt {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 7px;
      padding: 6px 4px;
      color: #e2e8f0;
      font-size: 10px;
      font-weight: 600;
      text-align: center;
      cursor: pointer;
    }
    .w11-snap-opt:hover, .w11-snap-opt:active {
      background: rgba(56, 189, 248, 0.25);
      border-color: #38bdf8;
    }
    .w11-win-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: #111318;
    }

    /* Resize Handles */
    .w11-rz-e {
      position: absolute;
      top: 38px;
      right: 0;
      width: 8px;
      bottom: 14px;
      cursor: ew-resize;
      z-index: 25;
      touch-action: none;
    }
    .w11-rz-s {
      position: absolute;
      left: 0;
      right: 14px;
      bottom: 0;
      height: 8px;
      cursor: ns-resize;
      z-index: 25;
      touch-action: none;
    }
    .w11-rz-se {
      position: absolute;
      right: 0;
      bottom: 0;
      width: 18px;
      height: 18px;
      cursor: nwse-resize;
      z-index: 30;
      touch-action: none;
      background: radial-gradient(circle at 12px 12px, rgba(255,255,255,0.45) 1.5px, transparent 2px);
    }

    .w11-ribbon {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      padding: 7px 10px;
      background: #1e212b;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      align-items: center;
      flex-shrink: 0;
    }
    .w11-rbtn {
      background: rgba(255, 255, 255, 0.09);
      color: #f8fafc;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 6px;
      padding: 5px 9px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .w11-rbtn:active, .w11-rbtn:hover { background: rgba(255, 255, 255, 0.2); }
    .w11-rbtn.primary { background: #2563eb; border-color: #3b82f6; }
    .w11-rbtn.emerald { background: #059669; border-color: #10b981; }
    .w11-rinput {
      background: #0f1117;
      color: #f8fafc;
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 6px;
      padding: 5px 8px;
      font-size: 12px;
    }
    .w11-status-bar {
      height: 24px;
      background: #1a1d26;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      padding: 0 18px 0 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: #94a3b8;
      flex-shrink: 0;
    }
  `;
  document.head.appendChild(style);

  // =========================================================================
  // FLUENT SVG ICONS
  // =========================================================================
  const ICONS = {
    start: '<svg viewBox="0 0 24 24" width="22" height="22"><rect x="2" y="2" width="9" height="9" rx="1.5" fill="#38BDF8"/><rect x="13" y="2" width="9" height="9" rx="1.5" fill="#0EA5E9"/><rect x="2" y="13" width="9" height="9" rx="1.5" fill="#0284C7"/><rect x="13" y="13" width="9" height="9" rx="1.5" fill="#2563EB"/></svg>',
    word: '<svg viewBox="0 0 48 48" width="30" height="30"><rect x="8" y="5" width="32" height="38" rx="4" fill="#185ABD"/><rect x="16" y="5" width="24" height="38" rx="4" fill="#2B7CD3"/><rect x="5" y="13" width="22" height="22" rx="3.5" fill="#103F91"/><text x="16" y="29" text-anchor="middle" fill="#fff" font-family="sans-serif" font-weight="800" font-size="14">W</text></svg>',
    excel: '<svg viewBox="0 0 48 48" width="30" height="30"><rect x="8" y="5" width="32" height="38" rx="4" fill="#107C41"/><rect x="16" y="5" width="24" height="38" rx="4" fill="#21A366"/><rect x="5" y="13" width="22" height="22" rx="3.5" fill="#0B5A2E"/><text x="16" y="29" text-anchor="middle" fill="#fff" font-family="sans-serif" font-weight="800" font-size="14">X</text></svg>',
    ppt: '<svg viewBox="0 0 48 48" width="30" height="30"><rect x="8" y="5" width="32" height="38" rx="4" fill="#C43E1C"/><rect x="16" y="5" width="24" height="38" rx="4" fill="#EB6C4D"/><rect x="5" y="13" width="22" height="22" rx="3.5" fill="#A92B11"/><text x="16" y="29" text-anchor="middle" fill="#fff" font-family="sans-serif" font-weight="800" font-size="14">P</text></svg>',
    paint: '<svg viewBox="0 0 48 48" width="30" height="30"><path d="M24 6C13.5 6 5 13.8 5 23.5c0 5.3 4.2 9.5 9.5 9.5h3.2c1.7 0 3 1.3 3 3 0 .8-.3 1.5-.8 2-.5.5-.8 1.2-.8 2 0 1.7 1.3 3 3 3h1.9c10.5 0 19-8.1 19-18.5C43 13.8 34.5 6 24 6z" fill="#38BDF8"/><circle cx="14.5" cy="20" r="3" fill="#EF4444"/><circle cx="21" cy="13.5" r="3" fill="#FACC15"/><circle cx="30" cy="14.5" r="3" fill="#22C55E"/><circle cx="34.5" cy="22" r="3" fill="#A855F7"/></svg>',
    code: '<svg viewBox="0 0 48 48" width="30" height="30"><rect x="5" y="7" width="38" height="34" rx="5" fill="#1E293B" stroke="#38BDF8" stroke-width="2"/><path d="M19 18l-7 6 7 6M29 18l7 6-7 6M26 15l-4 18" stroke="#38BDF8" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
    explorer: '<svg viewBox="0 0 48 48" width="30" height="30"><path d="M6 13a4 4 0 0 1 4-4h10l4 4h14a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V13z" fill="#F59E0B"/><rect x="6" y="17" width="36" height="22" rx="3" fill="#FBBF24"/><rect x="14" y="27" width="20" height="12" rx="2" fill="#2563EB"/></svg>',
    terminal: '<svg viewBox="0 0 48 48" width="30" height="30"><rect x="5" y="8" width="38" height="32" rx="5" fill="#0F172A" stroke="#475569" stroke-width="2"/><path d="M13 19l7 5-7 5M23 29h11" stroke="#38BDF8" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
    calc: '<svg viewBox="0 0 48 48" width="30" height="30"><rect x="9" y="5" width="30" height="38" rx="5" fill="#1E293B" stroke="#64748B" stroke-width="1.5"/><rect x="14" y="10" width="20" height="8" rx="2" fill="#38BDF8"/><circle cx="17" cy="24" r="2.2" fill="#cbd5e1"/><circle cx="24" cy="24" r="2.2" fill="#cbd5e1"/><circle cx="31" cy="24" r="2.2" fill="#f59e0b"/><circle cx="17" cy="31" r="2.2" fill="#cbd5e1"/><circle cx="24" cy="31" r="2.2" fill="#cbd5e1"/><circle cx="31" cy="31" r="2.2" fill="#f59e0b"/><rect x="14" y="36" width="20" height="3.5" rx="1.7" fill="#2563EB"/></svg>',
    taskmgr: '<svg viewBox="0 0 48 48" width="30" height="30"><rect x="6" y="8" width="36" height="32" rx="4" fill="#0F172A" stroke="#38BDF8" stroke-width="1.8"/><polyline points="10,27 17,27 21,16 26,33 30,22 38,22" fill="none" stroke="#10B981" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    personalize: '<svg viewBox="0 0 48 48" width="30" height="30"><rect x="6" y="8" width="36" height="32" rx="5" fill="#1E3A8A" stroke="#60A5FA" stroke-width="1.8"/><circle cx="17" cy="18" r="3.5" fill="#FBBF24"/><path d="M8 35l10-11 8 8 6-6 8 9z" fill="#34D399"/></svg>'
  };

  // =========================================================================
  // MULTI-WINDOW MANAGER WITH RESIZE HANDLES & SNAP LAYOUTS
  // =========================================================================
  let topZ = 200;
  let focusedAppId = null;
  const openWindows = new Map();

  const snapGhost = document.createElement('div');
  snapGhost.id = 'w11-snap-ghost';
  document.body.appendChild(snapGhost);

  function getWorkArea() {
    const tb = document.getElementById('w11-taskbar');
    const tbH = tb ? tb.offsetHeight : 48;
    return {
      top: 0,
      left: 0,
      width: window.innerWidth,
      height: Math.max(260, window.innerHeight - tbH)
    };
  }

  function applySnapZone(win, zone) {
    const wa = getWorkArea();
    win.classList.remove('maximized');
    win.classList.add('snapped');
    if (zone === 'max') {
      win.classList.remove('snapped');
      win.classList.add('maximized');
    } else if (zone === 'left') {
      win.style.left = '0px';
      win.style.top = '0px';
      win.style.width = Math.floor(wa.width / 2) + 'px';
      win.style.height = wa.height + 'px';
    } else if (zone === 'right') {
      const halfW = Math.floor(wa.width / 2);
      win.style.left = halfW + 'px';
      win.style.top = '0px';
      win.style.width = (wa.width - halfW) + 'px';
      win.style.height = wa.height + 'px';
    } else if (zone === 'top') {
      win.style.left = '0px';
      win.style.top = '0px';
      win.style.width = wa.width + 'px';
      win.style.height = Math.floor(wa.height / 2) + 'px';
    } else if (zone === 'bottom') {
      const halfH = Math.floor(wa.height / 2);
      win.style.left = '0px';
      win.style.top = halfH + 'px';
      win.style.width = wa.width + 'px';
      win.style.height = (wa.height - halfH) + 'px';
    }
  }

  function showSnapGhost(zone) {
    if (!zone) {
      snapGhost.style.display = 'none';
      return;
    }
    const wa = getWorkArea();
    snapGhost.style.display = 'block';
    if (zone === 'max') {
      snapGhost.style.left = '4px';
      snapGhost.style.top = '4px';
      snapGhost.style.width = (wa.width - 8) + 'px';
      snapGhost.style.height = (wa.height - 8) + 'px';
    } else if (zone === 'left') {
      snapGhost.style.left = '4px';
      snapGhost.style.top = '4px';
      snapGhost.style.width = (Math.floor(wa.width / 2) - 6) + 'px';
      snapGhost.style.height = (wa.height - 8) + 'px';
    } else if (zone === 'right') {
      const halfW = Math.floor(wa.width / 2);
      snapGhost.style.left = (halfW + 2) + 'px';
      snapGhost.style.top = '4px';
      snapGhost.style.width = (wa.width - halfW - 6) + 'px';
      snapGhost.style.height = (wa.height - 8) + 'px';
    }
  }

  function syncTaskbarState() {
    document.querySelectorAll('#w11-tb-apps [data-tb-app]').forEach((btn) => {
      const id = btn.dataset.tbApp;
      const win = openWindows.get(id);
      const isRunning = Boolean(win);
      const isFocused = isRunning && focusedAppId === id && win.style.display !== 'none';
      btn.classList.toggle('running', isRunning);
      btn.classList.toggle('focused', isFocused);
    });
  }

  function focusWindow(win) {
    topZ += 1;
    win.style.zIndex = String(topZ);
    win.style.display = 'flex';
    focusedAppId = win.dataset.appId || null;
    syncTaskbarState();
  }

  function toggleTaskbarApp(appId, launchFn) {
    const win = openWindows.get(appId);
    if (!win) {
      launchFn();
      return;
    }
    if (win.style.display === 'none') {
      focusWindow(win);
    } else if (focusedAppId === appId) {
      win.style.display = 'none';
      focusedAppId = null;
      syncTaskbarState();
    } else {
      focusWindow(win);
    }
  }

  function createWindow(appId, title, iconSvg, renderBodyFn, defaultMax) {
    if (openWindows.has(appId)) {
      const existing = openWindows.get(appId);
      focusWindow(existing);
      return existing;
    }

    const win = document.createElement('div');
    win.className = 'w11-app-win' + (defaultMax ? ' maximized' : '');
    win.dataset.appId = appId;
    const offset = (openWindows.size % 5) * 18;
    win.style.top = (42 + offset) + 'px';
    win.style.left = (16 + offset) + 'px';

    win.innerHTML = `
      <div class="w11-win-bar">
        <div class="w11-win-title">${iconSvg}<span>${escHtml(title)}</span></div>
        <div class="w11-win-ctrls">
          <button type="button" data-act="min" title="Minimize">&#8212;</button>
          <button type="button" data-act="snap" title="Snap Layouts">&#9707;</button>
          <button type="button" data-act="max" title="Maximize/Restore">&#9744;</button>
          <button type="button" class="cls" data-act="close" title="Close">&times;</button>
        </div>
        <div class="w11-snap-menu">
          <button type="button" class="w11-snap-opt" data-snap-zone="left">&#9703; Left 50%</button>
          <button type="button" class="w11-snap-opt" data-snap-zone="right">&#9704; Right 50%</button>
          <button type="button" class="w11-snap-opt" data-snap-zone="top">&#9705; Top 50%</button>
          <button type="button" class="w11-snap-opt" data-snap-zone="bottom">&#9706; Bottom 50%</button>
        </div>
      </div>
      <div class="w11-win-body"></div>
      <div class="w11-rz-e" data-rz="e"></div>
      <div class="w11-rz-s" data-rz="s"></div>
      <div class="w11-rz-se" data-rz="se"></div>
    `;

    win.addEventListener('mousedown', () => focusWindow(win));
    win.addEventListener('touchstart', () => focusWindow(win), { passive: true });

    const bar = win.querySelector('.w11-win-bar');
    const snapMenu = win.querySelector('.w11-snap-menu');

    bar.querySelector('[data-act="min"]').addEventListener('click', (e) => {
      e.stopPropagation();
      snapMenu.style.display = 'none';
      win.style.display = 'none';
      if (focusedAppId === appId) focusedAppId = null;
      syncTaskbarState();
    });

    bar.querySelector('[data-act="snap"]').addEventListener('click', (e) => {
      e.stopPropagation();
      snapMenu.style.display = snapMenu.style.display === 'grid' ? 'none' : 'grid';
    });

    snapMenu.querySelectorAll('[data-snap-zone]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        snapMenu.style.display = 'none';
        applySnapZone(win, btn.dataset.snapZone);
      });
    });

    bar.querySelector('[data-act="max"]').addEventListener('click', (e) => {
      e.stopPropagation();
      snapMenu.style.display = 'none';
      win.classList.remove('snapped');
      win.classList.toggle('maximized');
    });

    bar.addEventListener('dblclick', (e) => {
      if (e.target.closest('button')) return;
      win.classList.remove('snapped');
      win.classList.toggle('maximized');
    });

    bar.querySelector('[data-act="close"]').addEventListener('click', (e) => {
      e.stopPropagation();
      win.remove();
      openWindows.delete(appId);
      if (focusedAppId === appId) focusedAppId = null;
      syncTaskbarState();
    });

    // Drag + Edge-Snap Support
    let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0, pendingSnap = null;
    bar.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button') || e.target.closest('.w11-snap-menu')) return;
      snapMenu.style.display = 'none';
      if (win.classList.contains('maximized') || win.classList.contains('snapped')) {
        const rect = win.getBoundingClientRect();
        win.classList.remove('maximized', 'snapped');
        win.style.width = Math.min(640, window.innerWidth - 32) + 'px';
        win.style.height = Math.min(460, window.innerHeight - 110) + 'px';
        win.style.left = Math.max(8, Math.min(window.innerWidth - 200, e.clientX - 120)) + 'px';
        win.style.top = Math.max(4, rect.top) + 'px';
      }
      dragging = true;
      pendingSnap = null;
      sx = e.clientX;
      sy = e.clientY;
      ox = win.offsetLeft;
      oy = win.offsetTop;
      bar.setPointerCapture(e.pointerId);
    });

    bar.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      win.style.left = Math.max(-80, Math.min(window.innerWidth - 100, ox + (e.clientX - sx))) + 'px';
      win.style.top = Math.max(0, Math.min(window.innerHeight - 90, oy + (e.clientY - sy))) + 'px';

      if (e.clientX <= 16) pendingSnap = 'left';
      else if (e.clientX >= window.innerWidth - 16) pendingSnap = 'right';
      else if (e.clientY <= 12) pendingSnap = 'max';
      else pendingSnap = null;
      showSnapGhost(pendingSnap);
    });

    bar.addEventListener('pointerup', () => {
      if (!dragging) return;
      dragging = false;
      showSnapGhost(null);
      if (pendingSnap) {
        applySnapZone(win, pendingSnap);
        pendingSnap = null;
      }
    });

    // Edge & Corner Resize Handles
    win.querySelectorAll('[data-rz]').forEach((handle) => {
      let resizing = false, dir = '', rsx = 0, rsy = 0, sw = 0, sh = 0;
      handle.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        if (win.classList.contains('maximized')) {
          const rect = win.getBoundingClientRect();
          win.classList.remove('maximized');
          win.style.left = rect.left + 'px';
          win.style.top = rect.top + 'px';
          win.style.width = rect.width + 'px';
          win.style.height = rect.height + 'px';
        }
        win.classList.remove('snapped');
        resizing = true;
        dir = handle.dataset.rz;
        rsx = e.clientX;
        rsy = e.clientY;
        const rect = win.getBoundingClientRect();
        sw = rect.width;
        sh = rect.height;
        handle.setPointerCapture(e.pointerId);
      });
      handle.addEventListener('pointermove', (e) => {
        if (!resizing) return;
        const wa = getWorkArea();
        if (dir === 'e' || dir === 'se') {
          const maxW = wa.width - win.offsetLeft;
          win.style.width = Math.max(290, Math.min(maxW, sw + (e.clientX - rsx))) + 'px';
        }
        if (dir === 's' || dir === 'se') {
          const maxH = wa.height - win.offsetTop;
          win.style.height = Math.max(230, Math.min(maxH, sh + (e.clientY - rsy))) + 'px';
        }
      });
      handle.addEventListener('pointerup', () => { resizing = false; });
    });

    const body = win.querySelector('.w11-win-body');
    renderBodyFn(body, win);
    document.body.appendChild(win);
    openWindows.set(appId, win);
    focusWindow(win);
    return win;
  }

  // =========================================================================
  // 1. MICROSOFT WORD (Real .docx Import + Real .docx Export)
  // =========================================================================
  function openWord(docIdToLoad) {
    createWindow('word', 'Microsoft Word', ICONS.word, (body) => {
      let docs = readStore(KEYS.WORD_DOCS, []);
      let current = docs.find((d) => d.id === docIdToLoad) || docs[0] || {
        id: 'doc-' + Date.now(),
        title: 'Document1.docx',
        updated: new Date().toLocaleDateString(),
        html: '<p>Start typing your document...</p>'
      };

      body.innerHTML = `
        <div class="w11-ribbon" style="background:#16386e;">
          <select class="w11-rinput" id="wd-doc-select" style="max-width:140px;"></select>
          <button type="button" class="w11-rbtn" id="wd-new">+ New</button>
          <button type="button" class="w11-rbtn emerald" id="wd-open-docx">Open .docx</button>
          <input type="file" id="wd-file-input" accept=".docx,.txt,.html" style="display:none;">
          <button type="button" class="w11-rbtn primary" id="wd-export-docx">Export .docx</button>
          <button type="button" class="w11-rbtn" data-cmd="bold"><b>B</b></button>
          <button type="button" class="w11-rbtn" data-cmd="italic"><i>I</i></button>
          <button type="button" class="w11-rbtn" data-cmd="underline"><u>U</u></button>
          <button type="button" class="w11-rbtn" data-block="H1">H1</button>
          <button type="button" class="w11-rbtn" data-block="H2">H2</button>
          <button type="button" class="w11-rbtn" data-block="P">Body</button>
          <button type="button" class="w11-rbtn" data-cmd="insertUnorderedList">&bull; List</button>
          <button type="button" class="w11-rbtn" data-cmd="justifyLeft">Left</button>
          <button type="button" class="w11-rbtn" data-cmd="justifyCenter">Center</button>
        </div>
        <div style="flex:1;overflow-y:auto;background:#262934;padding:14px;display:flex;justify-content:center;">
          <div id="wd-page" contenteditable="true" style="width:100%;max-width:680px;min-height:100%;background:#ffffff;color:#0f172a;padding:24px 22px;border-radius:4px;box-shadow:0 8px 28px rgba(0,0,0,0.45);outline:none;font:15px/1.6 'Segoe UI',system-ui,sans-serif;"></div>
        </div>
        <div class="w11-status-bar">
          <span id="wd-status">Offline .docx ready</span>
          <span id="wd-counts">0 words</span>
        </div>
      `;

      const sel = body.querySelector('#wd-doc-select');
      const page = body.querySelector('#wd-page');
      const counts = body.querySelector('#wd-counts');
      const status = body.querySelector('#wd-status');
      const fileInput = body.querySelector('#wd-file-input');

      function refreshSelect() {
        docs = readStore(KEYS.WORD_DOCS, []);
        if (!docs.length) {
          docs = [current];
          writeStore(KEYS.WORD_DOCS, docs);
        }
        sel.innerHTML = docs.map((d) => `<option value="${escHtml(d.id)}" ${d.id === current.id ? 'selected' : ''}>${escHtml(d.title)}</option>`).join('');
      }

      function updateStats() {
        const txt = (page.innerText || '').trim();
        const words = txt ? txt.split(/\s+/).length : 0;
        counts.textContent = `${words} words • ${txt.length} chars`;
      }

      function persist() {
        current.html = page.innerHTML;
        current.updated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const idx = docs.findIndex((d) => d.id === current.id);
        if (idx >= 0) docs[idx] = current;
        else docs.unshift(current);
        writeStore(KEYS.WORD_DOCS, docs);
        status.textContent = `Auto-saved at ${current.updated}`;
        updateStats();
      }

      refreshSelect();
      page.innerHTML = current.html;
      updateStats();

      page.addEventListener('input', persist);
      sel.addEventListener('change', () => {
        const found = docs.find((d) => d.id === sel.value);
        if (found) {
          current = found;
          page.innerHTML = current.html;
          updateStats();
        }
      });

      body.querySelector('#wd-new').addEventListener('click', () => {
        const name = prompt('Document name:', `Document_${docs.length + 1}.docx`);
        if (!name) return;
        const cleanTitle = name.trim().endsWith('.docx') ? name.trim() : name.trim() + '.docx';
        current = { id: 'doc-' + Date.now(), title: cleanTitle, updated: 'Just now', html: `<h1>${escHtml(cleanTitle.replace(/\.docx$/i, ''))}</h1><p></p>` };
        docs.unshift(current);
        writeStore(KEYS.WORD_DOCS, docs);
        refreshSelect();
        page.innerHTML = current.html;
        updateStats();
      });

      body.querySelector('#wd-open-docx').addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
          status.textContent = `Importing ${file.name}...`;
          let importedHtml = '';
          if (file.name.toLowerCase().endsWith('.docx')) {
            const buf = await file.arrayBuffer();
            importedHtml = await importDocxArrayBuffer(buf);
          } else {
            const txt = await file.text();
            importedHtml = file.name.toLowerCase().endsWith('.html')
              ? txt
              : txt.split(/\r?\n/).map((line) => `<p>${escHtml(line) || '<br>'}</p>`).join('');
          }
          const title = file.name.toLowerCase().endsWith('.docx') ? file.name : file.name + '.docx';
          current = { id: 'doc-' + Date.now(), title, updated: 'Imported', html: importedHtml };
          docs.unshift(current);
          writeStore(KEYS.WORD_DOCS, docs);
          refreshSelect();
          page.innerHTML = current.html;
          updateStats();
          status.textContent = `Imported ${file.name}`;
        } catch (err) {
          alert('Could not open file: ' + err.message);
          status.textContent = 'Import failed';
        } finally {
          fileInput.value = '';
        }
      });

      body.querySelector('#wd-export-docx').addEventListener('click', async () => {
        try {
          status.textContent = 'Building .docx...';
          const blob = await exportDocxBlob(page.innerHTML);
          const outName = current.title.replace(/\.docx?$/i, '') + '.docx';
          downloadBlob(outName, blob);
          status.textContent = `Exported ${outName}`;
        } catch (err) {
          alert('Export error: ' + err.message);
          status.textContent = 'Export failed';
        }
      });

      body.querySelectorAll('[data-cmd]').forEach((btn) => {
        btn.addEventListener('click', () => {
          page.focus();
          document.execCommand(btn.dataset.cmd, false, null);
          persist();
        });
      });

      body.querySelectorAll('[data-block]').forEach((btn) => {
        btn.addEventListener('click', () => {
          page.focus();
          document.execCommand('formatBlock', false, btn.dataset.block);
          persist();
        });
      });
    }, true);
  }

  // =========================================================================
  // 2. MICROSOFT EXCEL (Real .xlsx Import + Real .xlsx Export)
  // =========================================================================
  function openExcel() {
    createWindow('excel', 'Microsoft Excel', ICONS.excel, (body) => {
      let sheet = readStore(KEYS.EXCEL_SHEETS, { name: 'Budget_Tracker.xlsx', rows: 26, cols: 10, cells: {} });
      let ROWS = Math.max(26, sheet.rows || 26);
      let COLS = Math.max(10, sheet.cols || 10);
      let activeCell = 'A1';

      function idxToCol(idx) {
        let s = '';
        let n = idx + 1;
        while (n > 0) {
          const rem = (n - 1) % 26;
          s = String.fromCharCode(65 + rem) + s;
          n = Math.floor((n - 1) / 26);
        }
        return s;
      }

      function colToIdx(col) {
        let res = 0;
        for (let i = 0; i < col.length; i++) {
          res = res * 26 + (col.charCodeAt(i) - 64);
        }
        return res - 1;
      }

      function evalCell(ref, visited = new Set()) {
        if (visited.has(ref)) return '#REF!';
        visited.add(ref);
        const raw = (sheet.cells[ref] ?? '').toString().trim();
        if (!raw.startsWith('=')) {
          const n = Number(raw);
          return raw !== '' && !Number.isNaN(n) ? n : raw;
        }
        let expr = raw.slice(1).toUpperCase();

        expr = expr.replace(/\b(SUM|AVERAGE|AVG|MIN|MAX|COUNT)\(([A-Z]+\d+):([A-Z]+\d+)\)/g, (_, fn, start, end) => {
          const m1 = start.match(/^([A-Z]+)(\d+)$/);
          const m2 = end.match(/^([A-Z]+)(\d+)$/);
          if (!m1 || !m2) return '0';
          const c1 = colToIdx(m1[1]), r1 = parseInt(m1[2], 10);
          const c2 = colToIdx(m2[1]), r2 = parseInt(m2[2], 10);
          const vals = [];
          for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
            for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
              const v = Number(evalCell(idxToCol(c) + r, new Set(visited)));
              if (!Number.isNaN(v)) vals.push(v);
            }
          }
          if (!vals.length) return '0';
          if (fn === 'SUM') return String(vals.reduce((a, b) => a + b, 0));
          if (fn === 'AVERAGE' || fn === 'AVG') return String(vals.reduce((a, b) => a + b, 0) / vals.length);
          if (fn === 'MIN') return String(Math.min(...vals));
          if (fn === 'MAX') return String(Math.max(...vals));
          if (fn === 'COUNT') return String(vals.length);
          return '0';
        });

        expr = expr.replace(/\b([A-Z]+)(\d+)\b/g, (_, col, row) => {
          const v = Number(evalCell(col + row, new Set(visited)));
          return Number.isNaN(v) ? '0' : String(v);
        });

        try {
          if (!/^[0-9+\-*/().\s]+$/.test(expr)) return '#ERR';
          const res = Function('"use strict";return (' + expr + ')')();
          return typeof res === 'number' && Number.isFinite(res) ? Math.round(res * 10000) / 10000 : '#ERR';
        } catch (_) {
          return '#ERR';
        }
      }

      body.innerHTML = `
        <div class="w11-ribbon" style="background:#0f5132;">
          <button type="button" class="w11-rbtn emerald" id="xl-open-xlsx">Open .xlsx</button>
          <input type="file" id="xl-file-input" accept=".xlsx,.xls,.csv" style="display:none;">
          <button type="button" class="w11-rbtn primary" id="xl-export-xlsx">Export .xlsx</button>
          <span id="xl-ref" style="background:#093621;padding:5px 9px;border-radius:6px;font-weight:700;font-size:12px;min-width:38px;text-align:center;">A1</span>
          <span style="font-weight:700;color:#86efac;">fx</span>
          <input type="text" class="w11-rinput" id="xl-fx" style="flex:1;min-width:130px;" placeholder="Enter value or formula (=SUM(D2:D4))">
          <button type="button" class="w11-rbtn" id="xl-clear">Clear</button>
        </div>
        <div style="flex:1;overflow:auto;background:#ffffff;color:#0f172a;">
          <table id="xl-grid" style="border-collapse:collapse;width:100%;font:13px/1.3 system-ui,sans-serif;"></table>
        </div>
        <div class="w11-status-bar">
          <span id="xl-sheet-name">${escHtml(sheet.name || 'Budget_Tracker.xlsx')}</span>
          <span id="xl-sum-bar">Ready</span>
        </div>
      `;

      const grid = body.querySelector('#xl-grid');
      const fx = body.querySelector('#xl-fx');
      const refBadge = body.querySelector('#xl-ref');
      const sumBar = body.querySelector('#xl-sum-bar');
      const sheetNameEl = body.querySelector('#xl-sheet-name');
      const fileInput = body.querySelector('#xl-file-input');

      function renderGrid() {
        const colNames = Array.from({ length: COLS }, (_, i) => idxToCol(i));
        let html = '<thead><tr><th style="background:#e2e8f0;border:1px solid #cbd5e1;width:36px;padding:5px;"></th>';
        for (const c of colNames) {
          html += `<th style="background:#e2e8f0;border:1px solid #cbd5e1;padding:5px 8px;min-width:86px;font-weight:700;color:#334155;">${c}</th>`;
        }
        html += '</tr></thead><tbody>';
        for (let r = 1; r <= ROWS; r++) {
          html += `<tr><td style="background:#f1f5f9;border:1px solid #cbd5e1;text-align:center;font-weight:600;color:#475569;padding:4px;">${r}</td>`;
          for (const c of colNames) {
            const ref = c + r;
            const val = evalCell(ref);
            const isSel = ref === activeCell;
            const isNum = typeof val === 'number';
            html += `<td data-ref="${ref}" style="border:${isSel ? '2px solid #107C41' : '1px solid #cbd5e1'};background:${isSel ? '#ecfdf5' : '#fff'};padding:5px 7px;text-align:${isNum ? 'right' : 'left'};white-space:nowrap;cursor:cell;">${escHtml(val)}</td>`;
          }
          html += '</tr>';
        }
        html += '</tbody>';
        grid.innerHTML = html;

        grid.querySelectorAll('td[data-ref]').forEach((td) => {
          td.addEventListener('click', () => {
            activeCell = td.dataset.ref;
            refBadge.textContent = activeCell;
            fx.value = sheet.cells[activeCell] ?? '';
            const evaluated = evalCell(activeCell);
            sumBar.textContent = `${activeCell}: ${evaluated}`;
            renderGrid();
            fx.focus();
          });
        });
      }

      fx.value = sheet.cells[activeCell] ?? '';
      fx.addEventListener('input', () => {
        if (fx.value === '') delete sheet.cells[activeCell];
        else sheet.cells[activeCell] = fx.value;
        writeStore(KEYS.EXCEL_SHEETS, sheet);
        renderGrid();
      });

      body.querySelector('#xl-open-xlsx').addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
          if (!window.XLSX) throw new Error('SheetJS offline library not loaded');
          sumBar.textContent = `Reading ${file.name}...`;
          const buf = await file.arrayBuffer();
          const wb = window.XLSX.read(buf, { type: 'array' });
          const firstSheetName = wb.SheetNames[0];
          const ws = wb.Sheets[firstSheetName];
          const newCells = {};
          let maxR = 26, maxC = 10;

          for (const addr of Object.keys(ws)) {
            if (addr.startsWith('!')) continue;
            const cell = ws[addr];
            if (!cell) continue;
            if (cell.f) newCells[addr] = '=' + cell.f;
            else if (cell.v !== undefined && cell.v !== null) newCells[addr] = String(cell.v);

            const m = addr.match(/^([A-Z]+)(\d+)$/);
            if (m) {
              maxC = Math.max(maxC, colToIdx(m[1]) + 2);
              maxR = Math.max(maxR, parseInt(m[2], 10) + 4);
            }
          }

          ROWS = Math.min(120, maxR);
          COLS = Math.min(26, maxC);
          sheet = {
            name: file.name.toLowerCase().endsWith('.xlsx') ? file.name : file.name + '.xlsx',
            rows: ROWS,
            cols: COLS,
            cells: newCells
          };
          writeStore(KEYS.EXCEL_SHEETS, sheet);
          activeCell = 'A1';
          refBadge.textContent = 'A1';
          fx.value = sheet.cells['A1'] ?? '';
          sheetNameEl.textContent = sheet.name;
          renderGrid();
          sumBar.textContent = `Imported ${file.name}`;
        } catch (err) {
          alert('Could not open spreadsheet: ' + err.message);
          sumBar.textContent = 'Import failed';
        } finally {
          fileInput.value = '';
        }
      });

      body.querySelector('#xl-export-xlsx').addEventListener('click', () => {
        try {
          if (!window.XLSX) throw new Error('SheetJS offline library not loaded');
          const ws = {};
          let maxR = 0, maxC = 0;

          for (const [ref, rawVal] of Object.entries(sheet.cells)) {
            const m = ref.match(/^([A-Z]+)(\d+)$/);
            if (!m) continue;
            const cIdx = colToIdx(m[1]);
            const rIdx = parseInt(m[2], 10) - 1;
            maxC = Math.max(maxC, cIdx);
            maxR = Math.max(maxR, rIdx);

            const str = String(rawVal ?? '');
            const evaluated = evalCell(ref);
            if (str.startsWith('=')) {
              const isNum = typeof evaluated === 'number';
              ws[ref] = {
                t: isNum ? 'n' : 's',
                v: isNum ? evaluated : String(evaluated),
                f: str.slice(1)
              };
            } else if (str !== '' && !Number.isNaN(Number(str))) {
              ws[ref] = { t: 'n', v: Number(str) };
            } else {
              ws[ref] = { t: 's', v: str };
            }
          }

          ws['!ref'] = window.XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: maxC, r: maxR } });
          const wb = window.XLSX.utils.book_new();
          window.XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
          const outBytes = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
          const blob = new Blob([outBytes], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });
          const outName = (sheet.name || 'AuroraOS_Sheet').replace(/\.xlsx?$/i, '') + '.xlsx';
          downloadBlob(outName, blob);
          sumBar.textContent = `Exported ${outName}`;
        } catch (err) {
          alert('Export error: ' + err.message);
          sumBar.textContent = 'Export failed';
        }
      });

      body.querySelector('#xl-clear').addEventListener('click', () => {
        if (!confirm('Clear all cells in spreadsheet?')) return;
        sheet.cells = {};
        writeStore(KEYS.EXCEL_SHEETS, sheet);
        fx.value = '';
        renderGrid();
      });

      renderGrid();
    }, true);
  }

  // =========================================================================
  // 3. MICROSOFT POWERPOINT (Real .pptx Import + Real .pptx Export)
  // =========================================================================
  function openPowerPoint() {
    createWindow('ppt', 'Microsoft PowerPoint', ICONS.ppt, (body) => {
      let deck = readStore(KEYS.PPT_DECKS, { name: 'Deck.pptx', theme: 'aurora', slides: [{ title: 'New Slide', subtitle: '', body: '', notes: '' }] });
      let idx = 0;

      const THEMES = {
        aurora: 'linear-gradient(135deg, #040b1a 0%, #0b254b 55%, #065f46 100%)',
        fluent: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)',
        crimson: 'linear-gradient(135deg, #1f1016 0%, #7f1d1d 100%)',
        light: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
      };

      body.innerHTML = `
        <div class="w11-ribbon" style="background:#7c2d12;">
          <button type="button" class="w11-rbtn emerald" id="pp-open-pptx">Open .pptx</button>
          <input type="file" id="pp-file-input" accept=".pptx" style="display:none;">
          <button type="button" class="w11-rbtn primary" id="pp-export-pptx">Export .pptx</button>
          <button type="button" class="w11-rbtn" id="pp-add">+ Slide</button>
          <button type="button" class="w11-rbtn" id="pp-del">Delete</button>
          <select class="w11-rinput" id="pp-theme">
            <option value="aurora">Theme: Aurora</option>
            <option value="fluent">Theme: Fluent Blue</option>
            <option value="crimson">Theme: Executive Red</option>
            <option value="light">Theme: Clean Light</option>
          </select>
          <button type="button" class="w11-rbtn" style="background:#ea580c;border-color:#fb923c;" id="pp-present">&#9654; Slideshow</button>
        </div>
        <div style="flex:1;display:flex;overflow:hidden;">
          <div id="pp-thumbs" style="width:110px;background:#181a22;border-right:1px solid rgba(255,255,255,0.1);overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:8px;flex-shrink:0;"></div>
          <div style="flex:1;padding:14px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;background:#111318;">
            <div id="pp-stage" style="border-radius:10px;padding:22px;min-height:240px;display:flex;flex-direction:column;justify-content:center;box-shadow:0 12px 32px rgba(0,0,0,0.55);border:1px solid rgba(255,255,255,0.16);">
              <input id="pp-title" style="background:transparent;border:1px dashed rgba(255,255,255,0.28);border-radius:6px;padding:6px 8px;font:700 22px system-ui,sans-serif;color:inherit;margin-bottom:8px;" placeholder="Slide Title">
              <input id="pp-sub" style="background:transparent;border:1px dashed rgba(255,255,255,0.22);border-radius:6px;padding:5px 8px;font:500 13px system-ui,sans-serif;color:inherit;opacity:0.88;margin-bottom:12px;" placeholder="Subtitle">
              <textarea id="pp-body" rows="5" style="background:transparent;border:1px dashed rgba(255,255,255,0.22);border-radius:6px;padding:8px;font:14px/1.55 system-ui,sans-serif;color:inherit;resize:vertical;" placeholder="Slide bullet points..."></textarea>
            </div>
          </div>
        </div>
        <div class="w11-status-bar">
          <span id="pp-count">Slide 1 of 1</span>
          <span id="pp-status">${escHtml(deck.name || 'AuroraOS_Overview.pptx')}</span>
        </div>
      `;

      const thumbs = body.querySelector('#pp-thumbs');
      const stage = body.querySelector('#pp-stage');
      const tIn = body.querySelector('#pp-title');
      const sIn = body.querySelector('#pp-sub');
      const bIn = body.querySelector('#pp-body');
      const themeSel = body.querySelector('#pp-theme');
      const countEl = body.querySelector('#pp-count');
      const statusEl = body.querySelector('#pp-status');
      const fileInput = body.querySelector('#pp-file-input');

      themeSel.value = deck.theme || 'aurora';

      function render() {
        if (idx >= deck.slides.length) idx = Math.max(0, deck.slides.length - 1);
        const s = deck.slides[idx];
        const th = deck.theme || 'aurora';
        stage.style.background = THEMES[th] || THEMES.aurora;
        stage.style.color = th === 'light' ? '#0f172a' : '#f8fafc';
        tIn.value = s.title || '';
        sIn.value = s.subtitle || '';
        bIn.value = s.body || '';
        countEl.textContent = `Slide ${idx + 1} of ${deck.slides.length}`;

        thumbs.innerHTML = deck.slides.map((sl, i) => `
          <div data-i="${i}" style="padding:8px;border-radius:6px;border:2px solid ${i === idx ? '#fb923c' : 'rgba(255,255,255,0.14)'};background:${i === idx ? 'rgba(234,88,12,0.2)' : 'rgba(255,255,255,0.05)'};cursor:pointer;font-size:11px;">
            <div style="font-weight:700;margin-bottom:2px;">${i + 1}. ${escHtml((sl.title || 'Untitled').slice(0, 14))}</div>
          </div>
        `).join('');

        thumbs.querySelectorAll('[data-i]').forEach((el) => {
          el.addEventListener('click', () => {
            idx = Number(el.dataset.i);
            render();
          });
        });
      }

      function save() {
        deck.slides[idx].title = tIn.value;
        deck.slides[idx].subtitle = sIn.value;
        deck.slides[idx].body = bIn.value;
        writeStore(KEYS.PPT_DECKS, deck);
        render();
      }

      [tIn, sIn, bIn].forEach((inp) => inp.addEventListener('input', save));
      themeSel.addEventListener('change', () => {
        deck.theme = themeSel.value;
        writeStore(KEYS.PPT_DECKS, deck);
        render();
      });

      // Import real .pptx
      body.querySelector('#pp-open-pptx').addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
          statusEl.textContent = `Importing ${file.name}...`;
          const buf = await file.arrayBuffer();
          const importedSlides = await importPptxArrayBuffer(buf);
          deck = {
            name: file.name,
            theme: deck.theme || 'aurora',
            slides: importedSlides
          };
          idx = 0;
          writeStore(KEYS.PPT_DECKS, deck);
          render();
          statusEl.textContent = `Imported ${file.name} (${importedSlides.length} slides)`;
        } catch (err) {
          alert('Could not open .pptx: ' + err.message);
          statusEl.textContent = 'Import failed';
        } finally {
          fileInput.value = '';
        }
      });

      // Export real .pptx
      body.querySelector('#pp-export-pptx').addEventListener('click', async () => {
        try {
          statusEl.textContent = 'Building .pptx...';
          const blob = await exportPptxBlob(deck);
          const outName = (deck.name || 'AuroraOS_Deck').replace(/\.pptx?$/i, '') + '.pptx';
          downloadBlob(outName, blob);
          statusEl.textContent = `Exported ${outName}`;
        } catch (err) {
          alert('Export error: ' + err.message);
          statusEl.textContent = 'Export failed';
        }
      });

      body.querySelector('#pp-add').addEventListener('click', () => {
        deck.slides.push({ title: `Slide ${deck.slides.length + 1}`, subtitle: 'Section subtitle', body: '• Point one\n• Point two', notes: '' });
        idx = deck.slides.length - 1;
        writeStore(KEYS.PPT_DECKS, deck);
        render();
      });

      body.querySelector('#pp-del').addEventListener('click', () => {
        if (deck.slides.length <= 1) return;
        deck.slides.splice(idx, 1);
        idx = Math.max(0, idx - 1);
        writeStore(KEYS.PPT_DECKS, deck);
        render();
      });

      body.querySelector('#pp-present').addEventListener('click', () => {
        let pIdx = idx;
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:20000;display:flex;flex-direction:column;justify-content:center;padding:28px;cursor:pointer;';
        function paintShow() {
          const sl = deck.slides[pIdx];
          const th = deck.theme || 'aurora';
          overlay.style.background = THEMES[th] || THEMES.aurora;
          overlay.style.color = th === 'light' ? '#0f172a' : '#f8fafc';
          overlay.innerHTML = `
            <div style="max-width:860px;margin:0 auto;width:100%;">
              <div style="font-size:clamp(26px,5vw,44px);font-weight:800;margin-bottom:10px;">${escHtml(sl.title)}</div>
              <div style="font-size:clamp(15px,2.5vw,22px);opacity:0.85;margin-bottom:24px;">${escHtml(sl.subtitle)}</div>
              <pre style="white-space:pre-wrap;font:clamp(16px,2.5vw,22px)/1.6 system-ui,sans-serif;margin:0;">${escHtml(sl.body)}</pre>
            </div>
            <div style="position:fixed;bottom:16px;right:20px;font-size:12px;opacity:0.75;">Slide ${pIdx + 1}/${deck.slides.length} • Tap to advance • Double-tap to exit</div>
          `;
        }
        overlay.addEventListener('click', () => {
          if (pIdx + 1 < deck.slides.length) { pIdx += 1; paintShow(); }
          else overlay.remove();
        });
        overlay.addEventListener('dblclick', () => overlay.remove());
        paintShow();
        document.body.appendChild(overlay);
      });

      render();
    }, true);
  }

  // =========================================================================
  // 4. MICROSOFT PAINT (Touch-Ready Canvas, Shapes, Flood Fill & PNG Export)
  // =========================================================================
  function openPaint() {
    createWindow('paint', 'Microsoft Paint', ICONS.paint, (body) => {
      const SWATCHES = ['#0f172a', '#ffffff', '#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#2563eb', '#8b5cf6', '#ec4899', '#92400e', '#64748b'];
      let tool = 'brush';
      let color = '#2563eb';
      let brushSize = 5;
      const undoStack = [];

      body.innerHTML = `
        <div class="w11-ribbon" style="background:#0c4a6e;">
          <button type="button" class="w11-rbtn primary" data-ptool="brush">Brush</button>
          <button type="button" class="w11-rbtn" data-ptool="eraser">Eraser</button>
          <button type="button" class="w11-rbtn" data-ptool="line">Line</button>
          <button type="button" class="w11-rbtn" data-ptool="rect">Rect</button>
          <button type="button" class="w11-rbtn" data-ptool="circle">Circle</button>
          <button type="button" class="w11-rbtn" data-ptool="fill">Fill</button>
          <label style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#e0f2fe;">
            Size <input type="range" id="pt-size" min="1" max="32" value="5" style="width:68px;">
          </label>
          <input type="color" id="pt-color" value="#2563eb" style="width:30px;height:28px;border:0;background:transparent;cursor:pointer;">
          <button type="button" class="w11-rbtn" id="pt-undo">Undo</button>
          <button type="button" class="w11-rbtn" id="pt-clear">Clear</button>
          <button type="button" class="w11-rbtn emerald" id="pt-open-img">Open Img</button>
          <input type="file" id="pt-img-input" accept="image/*" style="display:none;">
          <button type="button" class="w11-rbtn primary" id="pt-save-png">Save .png</button>
        </div>
        <div style="display:flex;gap:5px;padding:6px 10px;background:#161b26;border-bottom:1px solid rgba(255,255,255,0.08);overflow-x:auto;flex-shrink:0;">
          ${SWATCHES.map((hex) => `<button type="button" data-swatch="${hex}" style="width:22px;height:22px;border-radius:50%;border:2px solid rgba(255,255,255,0.35);background:${hex};cursor:pointer;flex-shrink:0;"></button>`).join('')}
        </div>
        <div style="flex:1;overflow:auto;background:#1e293b;display:flex;align-items:center;justify-content:center;padding:10px;">
          <canvas id="pt-canvas" width="720" height="460" style="background:#ffffff;border-radius:4px;box-shadow:0 8px 28px rgba(0,0,0,0.5);touch-action:none;max-width:100%;max-height:100%;cursor:crosshair;"></canvas>
        </div>
        <div class="w11-status-bar">
          <span id="pt-status">Tool: Brush • Size: 5px</span>
          <span>720 &times; 460 px</span>
        </div>
      `;

      const canvas = body.querySelector('#pt-canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const status = body.querySelector('#pt-status');
      const colorInp = body.querySelector('#pt-color');
      const sizeInp = body.querySelector('#pt-size');
      const imgInput = body.querySelector('#pt-img-input');

      // Initialize white canvas or restore saved artwork
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const savedDataUrl = localStorage.getItem(KEYS.PAINT_DATA);
      if (savedDataUrl) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        img.src = savedDataUrl;
      }

      function pushUndo() {
        if (undoStack.length >= 15) undoStack.shift();
        undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      }

      function persistCanvas() {
        try {
          localStorage.setItem(KEYS.PAINT_DATA, canvas.toDataURL('image/png'));
        } catch (_) {}
      }

      function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        return {
          x: Math.round(((e.clientX - rect.left) / rect.width) * canvas.width),
          y: Math.round(((e.clientY - rect.top) / rect.height) * canvas.height)
        };
      }

      function floodFill(startX, startY, hexColor) {
        if (startX < 0 || startY < 0 || startX >= canvas.width || startY >= canvas.height) return;
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        const w = canvas.width, h = canvas.height;
        const idx0 = (startY * w + startX) * 4;
        const sr = data[idx0], sg = data[idx0 + 1], sb = data[idx0 + 2];

        const tr = parseInt(hexColor.slice(1, 3), 16);
        const tg = parseInt(hexColor.slice(3, 5), 16);
        const tb = parseInt(hexColor.slice(5, 7), 16);
        if (Math.abs(sr - tr) < 6 && Math.abs(sg - tg) < 6 && Math.abs(sb - tb) < 6) return;

        const visited = new Uint8Array(w * h);
        const stack = [startY * w + startX];
        while (stack.length) {
          const p = stack.pop();
          if (visited[p]) continue;
          visited[p] = 1;
          const off = p * 4;
          if (Math.abs(data[off] - sr) <= 24 && Math.abs(data[off + 1] - sg) <= 24 && Math.abs(data[off + 2] - sb) <= 24) {
            data[off] = tr;
            data[off + 1] = tg;
            data[off + 2] = tb;
            data[off + 3] = 255;
            const x = p % w, y = (p - x) / w;
            if (x > 0) stack.push(p - 1);
            if (x + 1 < w) stack.push(p + 1);
            if (y > 0) stack.push(p - w);
            if (y + 1 < h) stack.push(p + w);
          }
        }
        ctx.putImageData(imgData, 0, 0);
      }

      let drawing = false, startPt = null, snapshot = null;

      canvas.addEventListener('pointerdown', (e) => {
        const pt = getPos(e);
        pushUndo();
        if (tool === 'fill') {
          floodFill(pt.x, pt.y, color);
          persistCanvas();
          return;
        }
        drawing = true;
        startPt = pt;
        snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
        canvas.setPointerCapture(e.pointerId);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = brushSize;
        ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
        if (tool === 'brush' || tool === 'eraser') {
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y);
          ctx.lineTo(pt.x + 0.1, pt.y + 0.1);
          ctx.stroke();
        }
      });

      canvas.addEventListener('pointermove', (e) => {
        if (!drawing) return;
        const pt = getPos(e);
        if (tool === 'brush' || tool === 'eraser') {
          ctx.lineTo(pt.x, pt.y);
          ctx.stroke();
        } else if (snapshot && startPt) {
          ctx.putImageData(snapshot, 0, 0);
          ctx.beginPath();
          if (tool === 'line') {
            ctx.moveTo(startPt.x, startPt.y);
            ctx.lineTo(pt.x, pt.y);
          } else if (tool === 'rect') {
            ctx.strokeRect(startPt.x, startPt.y, pt.x - startPt.x, pt.y - startPt.y);
            return;
          } else if (tool === 'circle') {
            const rx = Math.abs(pt.x - startPt.x) / 2;
            const ry = Math.abs(pt.y - startPt.y) / 2;
            const cx = (startPt.x + pt.x) / 2;
            const cy = (startPt.y + pt.y) / 2;
            ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          }
          ctx.stroke();
        }
      });

      canvas.addEventListener('pointerup', () => {
        if (!drawing) return;
        drawing = false;
        snapshot = null;
        persistCanvas();
      });

      body.querySelectorAll('[data-ptool]').forEach((btn) => {
        btn.addEventListener('click', () => {
          tool = btn.dataset.ptool;
          body.querySelectorAll('[data-ptool]').forEach((b) => b.classList.remove('primary'));
          btn.classList.add('primary');
          status.textContent = `Tool: ${tool.toUpperCase()} • Size: ${brushSize}px`;
        });
      });

      sizeInp.addEventListener('input', () => {
        brushSize = Number(sizeInp.value);
        status.textContent = `Tool: ${tool.toUpperCase()} • Size: ${brushSize}px`;
      });

      colorInp.addEventListener('input', () => { color = colorInp.value; });
      body.querySelectorAll('[data-swatch]').forEach((sw) => {
        sw.addEventListener('click', () => {
          color = sw.dataset.swatch;
          colorInp.value = color;
        });
      });

      body.querySelector('#pt-undo').addEventListener('click', () => {
        const prev = undoStack.pop();
        if (prev) {
          ctx.putImageData(prev, 0, 0);
          persistCanvas();
        }
      });

      body.querySelector('#pt-clear').addEventListener('click', () => {
        pushUndo();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        persistCanvas();
      });

      body.querySelector('#pt-open-img').addEventListener('click', () => imgInput.click());
      imgInput.addEventListener('change', (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        const url = URL.createObjectURL(f);
        const img = new Image();
        img.onload = () => {
          pushUndo();
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          persistCanvas();
        };
        img.src = url;
        imgInput.value = '';
      });

      body.querySelector('#pt-save-png').addEventListener('click', () => {
        canvas.toBlob((blob) => {
          if (blob) {
            downloadBlob('AuroraOS_Paint.png', blob);
            status.textContent = 'Saved AuroraOS_Paint.png';
          }
        }, 'image/png');
      });
    }, true);
  }

  // =========================================================================
  // 5. CODE STUDIO (Multi-Tab Editor + Line Numbers + Live HTML Preview)
  // =========================================================================
  function openCodeStudio() {
    createWindow('code', 'Code Studio', ICONS.code, (body) => {
      let state = readStore(KEYS.CODE_TABS, { activeId: 'tab-1', tabs: [{ id: 'tab-1', name: 'index.html', lang: 'HTML', code: '<h1>Hello AuroraOS</h1>' }] });
      let previewVisible = false;

      body.innerHTML = `
        <div class="w11-ribbon" style="background:#172033;">
          <div id="cs-tabs" style="display:flex;gap:4px;overflow-x:auto;max-width:260px;"></div>
          <button type="button" class="w11-rbtn" id="cs-new-tab">+ Tab</button>
          <button type="button" class="w11-rbtn emerald" id="cs-run">&#9654; Run Preview</button>
          <button type="button" class="w11-rbtn" id="cs-open-file">Open</button>
          <input type="file" id="cs-file-input" style="display:none;">
          <button type="button" class="w11-rbtn primary" id="cs-save-file">Export</button>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
          <div style="flex:1;display:flex;overflow:hidden;background:#0b0f19;">
            <pre id="cs-gutter" style="margin:0;padding:12px 8px;background:#0f1422;color:#64748b;text-align:right;user-select:none;font:13px/1.55 monospace;border-right:1px solid rgba(255,255,255,0.08);overflow:hidden;min-width:36px;">1</pre>
            <textarea id="cs-editor" spellcheck="false" autocomplete="off" style="flex:1;background:#0b0f19;color:#e2e8f0;border:0;outline:none;padding:12px;font:13px/1.55 monospace;resize:none;white-space:pre;overflow:auto;"></textarea>
          </div>
          <iframe id="cs-preview" sandbox="allow-scripts" style="display:none;height:44%;border:0;border-top:2px solid #2563eb;background:#ffffff;"></iframe>
        </div>
        <div class="w11-status-bar">
          <span id="cs-file-info">Ready</span>
          <span id="cs-cursor">Ln 1, Col 1</span>
        </div>
      `;

      const tabsEl = body.querySelector('#cs-tabs');
      const gutter = body.querySelector('#cs-gutter');
      const editor = body.querySelector('#cs-editor');
      const preview = body.querySelector('#cs-preview');
      const infoEl = body.querySelector('#cs-file-info');
      const cursorEl = body.querySelector('#cs-cursor');
      const fileInput = body.querySelector('#cs-file-input');

      function activeTab() {
        return state.tabs.find((t) => t.id === state.activeId) || state.tabs[0];
      }

      function updateGutter() {
        const lines = editor.value.split('\n').length;
        gutter.textContent = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
        gutter.scrollTop = editor.scrollTop;
      }

      function updateCursor() {
        const upTo = editor.value.slice(0, editor.selectionStart || 0).split('\n');
        cursorEl.textContent = `Ln ${upTo.length}, Col ${upTo[upTo.length - 1].length + 1}`;
      }

      function renderTabs() {
        const cur = activeTab();
        tabsEl.innerHTML = state.tabs.map((t) => `
          <button type="button" data-tid="${escHtml(t.id)}" class="w11-rbtn ${t.id === cur.id ? 'primary' : ''}" style="white-space:nowrap;">${escHtml(t.name)}</button>
        `).join('');
        tabsEl.querySelectorAll('[data-tid]').forEach((btn) => {
          btn.addEventListener('click', () => {
            state.activeId = btn.dataset.tid;
            writeStore(KEYS.CODE_TABS, state);
            loadActiveTab();
          });
        });
      }

      function loadActiveTab() {
        const cur = activeTab();
        editor.value = cur.code || '';
        infoEl.textContent = `${cur.name} • ${cur.lang || 'Text'} • Auto-saved`;
        updateGutter();
        updateCursor();
        renderTabs();
        if (previewVisible) preview.srcdoc = editor.value;
      }

      editor.addEventListener('input', () => {
        const cur = activeTab();
        cur.code = editor.value;
        writeStore(KEYS.CODE_TABS, state);
        updateGutter();
        updateCursor();
        if (previewVisible) preview.srcdoc = editor.value;
      });

      editor.addEventListener('scroll', () => { gutter.scrollTop = editor.scrollTop; });
      editor.addEventListener('click', updateCursor);
      editor.addEventListener('keyup', updateCursor);
      editor.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          const s = editor.selectionStart;
          const end = editor.selectionEnd;
          editor.value = editor.value.slice(0, s) + '  ' + editor.value.slice(end);
          editor.selectionStart = editor.selectionEnd = s + 2;
          editor.dispatchEvent(new Event('input'));
        }
      });

      body.querySelector('#cs-new-tab').addEventListener('click', () => {
        const name = prompt('New file name:', `snippet_${state.tabs.length + 1}.html`);
        if (!name) return;
        const ext = name.split('.').pop().toLowerCase();
        const lang = ext === 'py' ? 'Python' : ext === 'sh' ? 'Bash' : ext === 'js' ? 'JavaScript' : 'HTML';
        const newTab = { id: 'tab-' + Date.now(), name: name.trim(), lang, code: '' };
        state.tabs.push(newTab);
        state.activeId = newTab.id;
        writeStore(KEYS.CODE_TABS, state);
        loadActiveTab();
      });

      body.querySelector('#cs-run').addEventListener('click', () => {
        previewVisible = !previewVisible;
        preview.style.display = previewVisible ? 'block' : 'none';
        if (previewVisible) preview.srcdoc = editor.value;
      });

      body.querySelector('#cs-open-file').addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        const text = await f.text();
        const newTab = { id: 'tab-' + Date.now(), name: f.name, lang: f.name.split('.').pop().toUpperCase(), code: text };
        state.tabs.push(newTab);
        state.activeId = newTab.id;
        writeStore(KEYS.CODE_TABS, state);
        loadActiveTab();
        fileInput.value = '';
      });

      body.querySelector('#cs-save-file').addEventListener('click', () => {
        const cur = activeTab();
        downloadBlob(cur.name, new Blob([cur.code], { type: 'text/plain;charset=utf-8' }));
        infoEl.textContent = `Exported ${cur.name}`;
      });

      loadActiveTab();
    }, true);
  }

  // =========================================================================
  // 6. FILE EXPLORER
  // =========================================================================
  function openExplorer() {
    createWindow('explorer', 'File Explorer', ICONS.explorer, (body) => {
      const docs = readStore(KEYS.WORD_DOCS, []);
      const sheet = readStore(KEYS.EXCEL_SHEETS, { name: 'Budget_Tracker.xlsx' });
      const deck = readStore(KEYS.PPT_DECKS, { name: 'AuroraOS_Overview.pptx' });
      const codeState = readStore(KEYS.CODE_TABS, { tabs: [] });

      const items = [
        ...docs.map((d) => ({ name: d.title, kind: 'Word Document (.docx)', icon: ICONS.word, open: () => openWord(d.id) })),
        { name: sheet.name || 'Budget_Tracker.xlsx', kind: 'Excel Workbook (.xlsx)', icon: ICONS.excel, open: openExcel },
        { name: deck.name || 'AuroraOS_Overview.pptx', kind: 'PowerPoint Deck (.pptx)', icon: ICONS.ppt, open: openPowerPoint },
        { name: 'AuroraOS_Paint.png', kind: 'Paint Canvas Artwork', icon: ICONS.paint, open: openPaint },
        ...(codeState.tabs || []).slice(0, 2).map((t) => ({ name: t.name, kind: 'Code Studio Source', icon: ICONS.code, open: openCodeStudio }))
      ];

      body.innerHTML = `
        <div class="w11-ribbon">
          <span style="font-size:12px;color:#cbd5e1;">This PC &gt; Documents (C:\\Users\\Jeramy\\Documents)</span>
        </div>
        <div style="flex:1;overflow-y:auto;padding:12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;align-content:start;">
          ${items.map((it, i) => `
            <div data-fidx="${i}" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:12px 10px;text-align:center;cursor:pointer;">
              ${it.icon}
              <div style="font-size:12px;font-weight:600;margin-top:6px;word-break:break-word;">${escHtml(it.name)}</div>
              <div style="font-size:10.5px;color:#94a3b8;margin-top:2px;">${escHtml(it.kind)}</div>
            </div>
          `).join('')}
        </div>
      `;
      body.querySelectorAll('[data-fidx]').forEach((el) => {
        el.addEventListener('click', () => items[Number(el.dataset.fidx)].open());
      });
    }, false);
  }

  // =========================================================================
  // 7. WINDOWS TERMINAL / POWERSHELL
  // =========================================================================
  function openTerminal() {
    createWindow('terminal', 'Windows Terminal (PowerShell)', ICONS.terminal, (body) => {
      body.innerHTML = `
        <div id="tm-out" style="flex:1;overflow-y:auto;padding:12px;font:13px/1.5 monospace;color:#e2e8f0;white-space:pre-wrap;">AuroraOS PowerShell [Version 8.7.2026]
(c) Jeramy Adams. All rights reserved.
Type 'help' for available commands.

</div>
        <div style="display:flex;align-items:center;gap:6px;padding:8px 10px;background:#090d16;border-top:1px solid rgba(255,255,255,0.12);">
          <span style="color:#38bdf8;font:700 13px monospace;">PS C:\\AuroraOS&gt;</span>
          <input id="tm-in" type="text" autocomplete="off" style="flex:1;background:transparent;border:0;outline:none;color:#f8fafc;font:13px monospace;" placeholder="help">
        </div>
      `;
      const out = body.querySelector('#tm-out');
      const inp = body.querySelector('#tm-in');

      function print(line) {
        out.textContent += line + '\n';
        out.scrollTop = out.scrollHeight;
      }

      inp.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const raw = inp.value.trim();
        inp.value = '';
        print(`PS C:\\AuroraOS> ${raw}`);
        const [cmd, ...rest] = raw.split(/\s+/);
        const arg = rest.join(' ');
        switch ((cmd || '').toLowerCase()) {
          case '': break;
          case 'help':
            print('Commands: help, ver, systeminfo, ls, word, excel, ppt, paint, code, explorer, calc, taskmgr, wallpaper, clear');
            break;
          case 'ver':
            print('AuroraOS v8.7 (Win11 Android Capacitor + Full Office, Paint & Code Studio)');
            break;
          case 'systeminfo':
            print('Host Name:   MOTO-G-5G\nOS Name:     AuroraOS v8.7\nDeveloper:   Jeramy Adams\nEngines:     SheetJS (.xlsx) + JSZip OOXML (.docx/.pptx)');
            break;
          case 'ls':
          case 'dir':
            print('Documents/\n  AuroraOS Project Notes.docx\n  Budget_Tracker.xlsx\n  AuroraOS_Overview.pptx\n  AuroraOS_Paint.png');
            break;
          case 'word': openWord(); print('Launching Microsoft Word...'); break;
          case 'excel': openExcel(); print('Launching Microsoft Excel...'); break;
          case 'ppt': case 'powerpoint': openPowerPoint(); print('Launching Microsoft PowerPoint...'); break;
          case 'paint': openPaint(); print('Launching Microsoft Paint...'); break;
          case 'code': case 'studio': openCodeStudio(); print('Launching Code Studio...'); break;
          case 'explorer': openExplorer(); print('Launching File Explorer...'); break;
          case 'calc': openCalculator(); print('Launching Calculator...'); break;
          case 'taskmgr': openTaskManager(); print('Launching Task Manager...'); break;
          case 'wallpaper':
            document.querySelector('[data-win-action="personalize"]')?.click();
            print('Opening Wallpaper Personalizer...');
            break;
          case 'echo': print(arg); break;
          case 'clear': case 'cls': out.textContent = ''; break;
          default: print(`Command not recognized: ${cmd}. Type 'help'.`);
        }
      });
      setTimeout(() => inp.focus(), 50);
    }, false);
  }

  // =========================================================================
  // 8. CALCULATOR & 9. TASK MANAGER
  // =========================================================================
  function openCalculator() {
    createWindow('calc', 'Calculator', ICONS.calc, (body) => {
      let expr = '';
      body.innerHTML = `
        <div style="padding:14px;background:#0f172a;text-align:right;border-bottom:1px solid rgba(255,255,255,0.1);">
          <div id="cl-disp" style="font:700 28px/1.2 monospace;color:#f8fafc;overflow-x:auto;">0</div>
        </div>
        <div style="flex:1;display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:10px;background:#111318;">
          ${['C','(',')','/','7','8','9','*','4','5','6','-','1','2','3','+','0','.','DEL','='].map((k) => `
            <button type="button" data-k="${k}" style="border:0;border-radius:8px;font:600 17px system-ui,sans-serif;cursor:pointer;background:${k === '=' ? '#2563eb' : 'rgba(255,255,255,0.09)'};color:#fff;">${k}</button>
          `).join('')}
        </div>
      `;
      const disp = body.querySelector('#cl-disp');
      body.querySelectorAll('[data-k]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const k = btn.dataset.k;
          if (k === 'C') expr = '';
          else if (k === 'DEL') expr = expr.slice(0, -1);
          else if (k === '=') {
            try {
              if (/^[0-9+\-*/().]+$/.test(expr)) {
                expr = String(Function('"use strict";return (' + expr + ')')());
              }
            } catch (_) { expr = 'Error'; }
          } else {
            if (expr === 'Error') expr = '';
            expr += k;
          }
          disp.textContent = expr || '0';
        });
      });
    }, false);
  }

  function openTaskManager() {
    createWindow('taskmgr', 'Task Manager', ICONS.taskmgr, (body) => {
      const rows = Array.from(openWindows.entries());
      let usedBytes = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        usedBytes += (k.length + (localStorage.getItem(k) || '').length) * 2;
      }
      body.innerHTML = `
        <div style="padding:12px;overflow-y:auto;flex:1;">
          <div style="margin-bottom:12px;padding:10px;background:rgba(255,255,255,0.06);border-radius:8px;font-size:12px;">
            <b>Offline Storage Used:</b> ${(usedBytes / 1024).toFixed(1)} KB &bull; <b>Active Windows:</b> ${rows.length}
          </div>
          ${rows.map(([id, win]) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.08);font-size:13px;">
              <span>${escHtml(win.querySelector('.w11-win-title span').textContent)}</span>
              <button type="button" data-kill="${escHtml(id)}" class="w11-rbtn" style="background:#b91c1c;">End Task</button>
            </div>
          `).join('')}
        </div>
      `;
      body.querySelectorAll('[data-kill]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const w = openWindows.get(btn.dataset.kill);
          if (w) { w.remove(); openWindows.delete(btn.dataset.kill); }
          syncTaskbarState();
          openTaskManager();
        });
      });
    }, false);
  }

  // =========================================================================
  // APP REGISTRY, DESKTOP SHORTCUTS, START MENU & TASKBAR
  // =========================================================================
  const APPS = [
    { id: 'word', label: 'Word', keywords: 'word docx document write office', icon: ICONS.word, fn: () => openWord() },
    { id: 'excel', label: 'Excel', keywords: 'excel xlsx spreadsheet csv formula office', icon: ICONS.excel, fn: openExcel },
    { id: 'ppt', label: 'PowerPoint', keywords: 'powerpoint pptx slides presentation office', icon: ICONS.ppt, fn: openPowerPoint },
    { id: 'paint', label: 'Paint', keywords: 'paint draw canvas art image png', icon: ICONS.paint, fn: openPaint },
    { id: 'code', label: 'Code Studio', keywords: 'code ide html python bash javascript editor', icon: ICONS.code, fn: openCodeStudio },
    { id: 'explorer', label: 'Explorer', keywords: 'files folder documents explorer', icon: ICONS.explorer, fn: openExplorer },
    { id: 'terminal', label: 'Terminal', keywords: 'terminal powershell cmd bash shell', icon: ICONS.terminal, fn: openTerminal },
    { id: 'calc', label: 'Calculator', keywords: 'calculator math numbers', icon: ICONS.calc, fn: openCalculator },
    { id: 'taskmgr', label: 'Task Mgr', keywords: 'task manager memory processes', icon: ICONS.taskmgr, fn: openTaskManager },
    {
      id: 'personalize',
      label: 'Personalize',
      keywords: 'wallpaper background theme personalize',
      icon: ICONS.personalize,
      fn: () => document.querySelector('[data-win-action="personalize"]')?.click()
    },
    { id: 'aq-cortex', label: 'Cortex AI', keywords: 'cortex ai brain assistant', icon: '<span class="aq-ico">\uD83E\uDDE0</span>', fn: () => { if (window.launchAuroraV2App) window.launchAuroraV2App('cortex'); } },
    { id: 'aq-edge', label: 'EdgeRider', keywords: 'edgerider trips gig mileage telemetry', icon: '<span class="aq-ico">\uD83D\uDE97</span>', fn: () => { if (window.__aqPanel) window.__aqPanel('edge'); } },
    { id: 'aq-shop', label: 'ShopSense', keywords: 'shopsense obd dtc codes vehicle', icon: '<span class="aq-ico">\uD83D\uDD27</span>', fn: () => { if (window.__aqPanel) window.__aqPanel('shop'); } }
  ];

  // Desktop Shortcut Grid (Positioned below Personalize icon)
  const deskGrid = document.createElement('div');
  deskGrid.id = 'w11-icon-column';
  deskGrid.innerHTML = APPS.slice(0, 8).map((a) => `
    <div class="w11-desk-app" data-launch="${a.id}" role="button" tabindex="0">
      ${a.icon}
      <span>${a.label}</span>
    </div>
  `).join('');
  document.body.appendChild(deskGrid);

  deskGrid.querySelectorAll('[data-launch]').forEach((el) => {
    el.addEventListener('click', () => {
      const app = APPS.find((a) => a.id === el.dataset.launch);
      if (app) app.fn();
    });
  });

  // Full Windows 11 Start Menu
  const startMenu = document.createElement('div');
  startMenu.id = 'w11-start-menu';
  startMenu.innerHTML = `
    <div class="w11-sm-body">
      <input type="text" class="w11-sm-search" id="w11-sm-search-input" placeholder="Search apps, .docx / .xlsx / .pptx files, Paint, Code...">
      <div class="w11-sm-sec-head">
        <span>Pinned</span>
        <span style="font-size:11px;color:#38bdf8;font-weight:600;">AuroraOS Win11</span>
      </div>
      <div class="w11-sm-grid" id="w11-sm-pinned"></div>
      <div class="w11-sm-sec-head">
        <span>Recommended</span>
        <span style="font-size:11px;color:#94a3b8;font-weight:500;">Offline Storage</span>
      </div>
      <div class="w11-sm-rec-list" id="w11-sm-rec"></div>
    </div>
    <div class="w11-sm-footer">
      <div class="w11-sm-user">
        <div class="w11-sm-avatar">JA</div>
        <div>
          <div>Jeramy Adams</div>
          <div style="font-size:10px;color:#94a3b8;font-weight:400;">AuroraOS Administrator</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;">
        <button type="button" class="w11-rbtn" id="w11-btn-lock" title="Lock Desktop">&#128274; Lock</button>
        <button type="button" class="w11-rbtn" id="w11-btn-closeall" title="Close All Windows">&#9211; Close All</button>
      </div>
    </div>
  `;
  document.body.appendChild(startMenu);

  const smSearch = startMenu.querySelector('#w11-sm-search-input');
  const smPinned = startMenu.querySelector('#w11-sm-pinned');
  const smRec = startMenu.querySelector('#w11-sm-rec');

  function renderStartMenuContent(filterText = '') {
    const q = filterText.trim().toLowerCase();
    const filteredApps = APPS.filter((a) => !q || a.label.toLowerCase().includes(q) || a.keywords.includes(q));
    smPinned.innerHTML = filteredApps.map((a) => `
      <button type="button" class="w11-sm-tile" data-sm-app="${a.id}">
        ${a.icon}
        <span>${escHtml(a.label)}</span>
      </button>
    `).join('');

    smPinned.querySelectorAll('[data-sm-app]').forEach((btn) => {
      btn.addEventListener('click', () => {
        toggleStartMenu(false);
        const app = APPS.find((a) => a.id === btn.dataset.smApp);
        if (app) app.fn();
      });
    });

    const docs = readStore(KEYS.WORD_DOCS, []);
    const sheet = readStore(KEYS.EXCEL_SHEETS, { name: 'Budget_Tracker.xlsx' });
    const deck = readStore(KEYS.PPT_DECKS, { name: 'AuroraOS_Overview.pptx' });

    const recItems = [
      ...docs.slice(0, 2).map((d) => ({ title: d.title, sub: 'Microsoft Word • ' + (d.updated || 'Saved'), icon: ICONS.word, open: () => openWord(d.id) })),
      { title: sheet.name || 'Budget_Tracker.xlsx', sub: 'Microsoft Excel • Workbook', icon: ICONS.excel, open: openExcel },
      { title: deck.name || 'AuroraOS_Overview.pptx', sub: 'Microsoft PowerPoint • Deck', icon: ICONS.ppt, open: openPowerPoint },
      { title: 'AuroraOS_Paint.png', sub: 'Microsoft Paint • Canvas', icon: ICONS.paint, open: openPaint }
    ].filter((it) => !q || it.title.toLowerCase().includes(q) || it.sub.toLowerCase().includes(q));

    smRec.innerHTML = recItems.map((it, idx) => `
      <button type="button" class="w11-sm-rec-item" data-rec-idx="${idx}">
        ${it.icon}
        <div style="min-width:0;">
          <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(it.title)}</div>
          <div style="font-size:10.5px;color:#94a3b8;">${escHtml(it.sub)}</div>
        </div>
      </button>
    `).join('');

    smRec.querySelectorAll('[data-rec-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        toggleStartMenu(false);
        recItems[Number(btn.dataset.recIdx)].open();
      });
    });
  }

  smSearch.addEventListener('input', () => renderStartMenuContent(smSearch.value));

  startMenu.querySelector('#w11-btn-lock').addEventListener('click', () => {
    toggleStartMenu(false);
    const lock = document.createElement('div');
    lock.style.cssText = 'position:fixed;inset:0;z-index:30000;background:rgba(4,11,26,0.88);backdrop-filter:blur(28px);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui,sans-serif;cursor:pointer;';
    const now = new Date();
    lock.innerHTML = `
      <div style="font-size:56px;font-weight:200;letter-spacing:-1px;">${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      <div style="font-size:16px;opacity:0.85;margin-bottom:28px;">${now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</div>
      <div style="padding:10px 22px;border-radius:999px;background:rgba(255,255,255,0.14);border:1px solid rgba(255,255,255,0.24);font-size:13px;font-weight:600;">Tap anywhere to unlock AuroraOS</div>
    `;
    lock.addEventListener('click', () => lock.remove());
    document.body.appendChild(lock);
  });

  startMenu.querySelector('#w11-btn-closeall').addEventListener('click', () => {
    toggleStartMenu(false);
    for (const [, win] of openWindows.entries()) win.remove();
    openWindows.clear();
    focusedAppId = null;
    syncTaskbarState();
  });

  // Quick Settings Flyout
  const quickPanel = document.createElement('div');
  quickPanel.id = 'w11-quick-settings';
  quickPanel.innerHTML = `
    <div style="font-size:12px;font-weight:700;margin-bottom:10px;color:#e2e8f0;">Quick Settings</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
      <div style="background:rgba(37,99,235,0.35);border:1px solid #3b82f6;border-radius:8px;padding:9px;font-size:11.5px;font-weight:600;">&#128246; Connected</div>
      <div style="background:rgba(16,185,129,0.25);border:1px solid #10b981;border-radius:8px;padding:9px;font-size:11.5px;font-weight:600;">&#128190; Offline Ready</div>
    </div>
    <button type="button" id="w11-qs-wall" class="w11-rbtn primary" style="width:100%;">Change Desktop Wallpaper</button>
  `;
  document.body.appendChild(quickPanel);
  quickPanel.querySelector('#w11-qs-wall').addEventListener('click', () => {
    quickPanel.style.display = 'none';
    document.querySelector('[data-win-action="personalize"]')?.click();
  });

  // Full Windows 11 Bottom Taskbar
  const taskbar = document.createElement('div');
  taskbar.id = 'w11-taskbar';
  taskbar.innerHTML = `
    <div class="w11-tb-left">
      <button type="button" class="w11-tb-btn" id="w11-start-btn" title="Start">${ICONS.start}</button>
      <button type="button" class="w11-tb-search-pill" id="w11-search-btn" title="Search">&#128269; <span>Search</span></button>
    </div>
    <div class="w11-tb-center" id="w11-tb-apps">
      ${APPS.slice(0, 7).map((a) => `
        <button type="button" class="w11-tb-btn" data-tb-app="${a.id}" title="${escHtml(a.label)}">${a.icon}</button>
      `).join('')}
    </div>
    <div class="w11-tb-tray">
      <button type="button" class="w11-tray-pill" id="w11-tray-btn" title="Quick Settings & Clock">
        <span>&#128246;</span>
        <span>&#128267;</span>
        <div class="w11-clock">
          <div id="w11-clock-time">12:00 PM</div>
          <div id="w11-clock-date" style="font-size:10px;color:#cbd5e1;">11/17/2026</div>
        </div>
      </button>
    </div>
  `;
  document.body.appendChild(taskbar);

  const startBtn = taskbar.querySelector('#w11-start-btn');
  const searchBtn = taskbar.querySelector('#w11-search-btn');
  const trayBtn = taskbar.querySelector('#w11-tray-btn');

  function toggleStartMenu(forceState, focusSearch = false) {
    const isOpen = startMenu.style.display === 'flex';
    const next = typeof forceState === 'boolean' ? forceState : !isOpen;
    quickPanel.style.display = 'none';
    if (next) {
      smSearch.value = '';
      renderStartMenuContent('');
      startMenu.style.display = 'flex';
      startBtn.classList.add('active');
      if (focusSearch) setTimeout(() => smSearch.focus(), 40);
    } else {
      startMenu.style.display = 'none';
      startBtn.classList.remove('active');
    }
  }

  startBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleStartMenu();
  });

  searchBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleStartMenu(true, true);
  });

  trayBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleStartMenu(false);
    quickPanel.style.display = quickPanel.style.display === 'block' ? 'none' : 'block';
  });

  taskbar.querySelectorAll('[data-tb-app]').forEach((btn) => {
    btn.addEventListener('click', () => {
      toggleStartMenu(false);
      const id = btn.dataset.tbApp;
      const app = APPS.find((a) => a.id === id);
      if (app) toggleTaskbarApp(id, app.fn);
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#w11-start-menu, #w11-start-btn, #w11-search-btn')) {
      toggleStartMenu(false);
    }
    if (!e.target.closest('#w11-quick-settings, #w11-tray-btn')) {
      quickPanel.style.display = 'none';
    }
    if (!e.target.closest('.w11-snap-menu, [data-act="snap"]')) {
      document.querySelectorAll('.w11-snap-menu').forEach((m) => { m.style.display = 'none'; });
    }
  });

  function updateClock() {
    const now = new Date();
    const tEl = document.getElementById('w11-clock-time');
    const dEl = document.getElementById('w11-clock-date');
    if (tEl) tEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (dEl) dEl.textContent = now.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: 'numeric' });
  }
  updateClock();
  setInterval(updateClock, 15000);

  // Global Launcher API
  window.AuroraOffice = {
    openWord,
    openExcel,
    openPowerPoint,
    openPaint,
    openCodeStudio,
    openExplorer,
    openTerminal,
    openCalculator,
    openTaskManager,
    toggleStartMenu
  };
})();
