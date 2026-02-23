/**
 * FitBoard — Google Apps Script para AITOR GALVEZ (PERSONALIZADO)
 * =================================================
 * Adaptado a la estructura exacta del Google Sheet.
 * REEMPLAZA COMPLETAMENTE el script anterior.
 *
 * HOJAS UTILIZADAS:
 *   - "Datos S1 - S4"   → pesos semanas 1-4  (col C=fecha, col D=peso, filas 23-29, 39-45, 55-61, 71-77)
 *   - "Datos S5 - S8"   → pesos semanas 5-8  (misma estructura)
 *   - "Datos S9 - S12"  → pesos semanas 9-12 (misma estructura)
 *   - "DIETA ENTRENO"   → dieta días entreno  (4 comidas en columnas, desde fila 11)
 *   - "DIETA DESCANSO"  → dieta días descanso (misma estructura)
 *   - "ENTRENAMIENTO S1 - S4" / "S5 - S8" / "S9 - S12" → sesiones de ejercicios
 */

// ─── ROUTER ───────────────────────────────────────────────────────────────────
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || '';
  let result;
  try {
    switch (action) {
      case 'getWeights':  result = getWeights(); break;
      case 'logWeight':   result = logWeight(e.parameter.date, e.parameter.weight); break;
      case 'getDiet':     result = getDiet(e.parameter.type || 'entreno'); break;
      case 'getTraining': result = getTraining(); break;
      default:            result = { error: 'Unknown action: ' + action };
    }
  } catch (err) {
    result = { error: err.toString() };
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('No se encontró la pestaña: ' + name);
  return sheet;
}

function cellVal(sheet, row, col) {
  const v = sheet.getRange(row, col).getValue();
  return (v === '' || v === null || v === undefined) ? null : v;
}

function formatDate(d) {
  if (!d) return null;
  if (d instanceof Date) return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  return String(d);
}

function parseDateStr(s) {
  if (!s) return 0;
  const parts = String(s).split('/');
  if (parts.length === 3) return new Date(parts[2], parts[1]-1, parts[0]).getTime();
  return 0;
}

// ─── PESOS ────────────────────────────────────────────────────────────────────
// Cada hoja "Datos Sx" tiene bloques de 7 filas (una por día). Col C=fecha, D=peso.
const WEIGHT_SHEETS = [
  { name: 'Datos S1 - S4',  blocks: [
    { label: 'S1', rows: [23,24,25,26,27,28,29] },
    { label: 'S2', rows: [39,40,41,42,43,44,45] },
    { label: 'S3', rows: [55,56,57,58,59,60,61] },
    { label: 'S4', rows: [71,72,73,74,75,76,77] }
  ]},
  { name: 'Datos S5 - S8',  blocks: [
    { label: 'S5', rows: [23,24,25,26,27,28,29] },
    { label: 'S6', rows: [39,40,41,42,43,44,45] },
    { label: 'S7', rows: [55,56,57,58,59,60,61] },
    { label: 'S8', rows: [71,72,73,74,75,76,77] }
  ]},
  { name: 'Datos S9 - S12', blocks: [
    { label: 'S9',  rows: [23,24,25,26,27,28,29] },
    { label: 'S10', rows: [39,40,41,42,43,44,45] },
    { label: 'S11', rows: [55,56,57,58,59,60,61] },
    { label: 'S12', rows: [71,72,73,74,75,76,77] }
  ]}
];

function getWeights() {
  const weights = [];
  WEIGHT_SHEETS.forEach(sheetDef => {
    let sheet;
    try { sheet = getSheet(sheetDef.name); } catch(e) { return; }
    sheetDef.blocks.forEach(block => {
      block.rows.forEach(rowNum => {
        const date   = cellVal(sheet, rowNum, 3); // col C
        const weight = cellVal(sheet, rowNum, 4); // col D
        const dateStr = formatDate(date);
        if (dateStr) {
          // Include ALL days (with or without weight) so the selector shows all options
          weights.push({
            date:   dateStr,
            weight: (weight && !isNaN(parseFloat(weight))) ? parseFloat(weight) : null,
            week:   block.label,
            sheet:  sheetDef.name,
            row:    rowNum
          });
        }
      });
    });
  });
  weights.sort((a, b) => parseDateStr(a.date) - parseDateStr(b.date));
  return { weights };
}

function logWeight(dateStr, weightVal) {
  if (!dateStr || !weightVal) throw new Error('Faltan parámetros');
  const weight = parseFloat(weightVal);
  let added = false;

  // Busca la primera fila con fecha pero sin peso y la rellena
  for (let si = 0; si < WEIGHT_SHEETS.length && !added; si++) {
    const sheetDef = WEIGHT_SHEETS[si];
    let sheet;
    try { sheet = getSheet(sheetDef.name); } catch(e) { continue; }
    for (let bi = 0; bi < sheetDef.blocks.length && !added; bi++) {
      const block = sheetDef.blocks[bi];
      for (let ri = 0; ri < block.rows.length && !added; ri++) {
        const rowNum = block.rows[ri];
        const existingDate   = cellVal(sheet, rowNum, 3); // col C (fecha autocalculada)
        const existingWeight = cellVal(sheet, rowNum, 4); // col D (a rellenar)
        if (existingDate && !existingWeight) {
          sheet.getRange(rowNum, 4).setValue(weight);
          added = true;
        }
      }
    }
  }

  if (!added) {
    // Fallback: pestaña auxiliar "Pesos Extra"
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let extra = ss.getSheetByName('Pesos Extra');
    if (!extra) { extra = ss.insertSheet('Pesos Extra'); extra.appendRow(['Fecha', 'Peso']); }
    extra.appendRow([dateStr, weight]);
  }
  return { success: true, date: dateStr, weight, inserted: added ? 'sheet' : 'extra' };
}

// Escribe el peso en la fila exacta que corresponde a la fecha indicada
function logWeightByDate(dateStr, weightVal) {
  if (!dateStr || !weightVal) throw new Error('Faltan parámetros');
  const weight = parseFloat(weightVal);
  let found = false;

  for (let si = 0; si < WEIGHT_SHEETS.length && !found; si++) {
    const sheetDef = WEIGHT_SHEETS[si];
    let sheet;
    try { sheet = getSheet(sheetDef.name); } catch(e) { continue; }
    for (let bi = 0; bi < sheetDef.blocks.length && !found; bi++) {
      const block = sheetDef.blocks[bi];
      for (let ri = 0; ri < block.rows.length && !found; ri++) {
        const rowNum = block.rows[ri];
        const rowDate = formatDate(cellVal(sheet, rowNum, 3)); // col C
        if (rowDate === dateStr) {
          sheet.getRange(rowNum, 4).setValue(weight); // col D
          found = true;
        }
      }
    }
  }

  if (!found) throw new Error('No se encontró la fecha ' + dateStr + ' en el sheet');
  return { success: true, date: dateStr, weight };
}

// ─── DIETA ────────────────────────────────────────────────────────────────────
// 4 comidas en columnas paralelas. Cada comida tiene varias "OPCIÓN X" con alimentos.
// Columnas (1-indexed): Comida1=B,C,D(2,3,4) · Comida2=F,G,H(6,7,8) · Comida3=J,K,L(10,11,12) · Comida4=N,O,P(14,15,16)
const MEAL_DEFS = [
  { name: 'Desayuno',          cols: [2,3,4]    },
  { name: 'Comida',            cols: [6,7,8]    },
  { name: 'Merienda / Recena', cols: [10,11,12] },
  { name: 'Cena',              cols: [14,15,16] }
];

function getDiet(type) {
  const sheetName = (type === 'descanso') ? 'DIETA DESCANSO' : 'DIETA ENTRENO';
  const sheet = getSheet(sheetName);
  const maxRow = Math.min(sheet.getLastRow(), 130);
  const meals = [];

  MEAL_DEFS.forEach(mealDef => {
    const options = [];
    let current = null;

    for (let row = 11; row <= maxRow; row++) {
      const nameVal  = cellVal(sheet, row, mealDef.cols[0]);
      const macroVal = cellVal(sheet, row, mealDef.cols[1]);
      const qtyVal   = cellVal(sheet, row, mealDef.cols[2]);
      if (!nameVal && !macroVal && !qtyVal) continue;

      const nameStr = String(nameVal || '').trim();
      if (/^OPCI[ÓO]N/i.test(nameStr)) {
        if (current) options.push(current);
        current = { option: nameStr, foods: [] };
      } else if (nameStr) {
        if (!current) current = { option: 'Opción 1', foods: [] };
        current.foods.push({
          food:  nameStr,
          macro: String(macroVal || '').trim(),
          qty:   String(qtyVal  || '').trim()
        });
      }
    }
    if (current) options.push(current);
    if (options.length) meals.push({ meal: mealDef.name, options });
  });

  return { type: sheetName, meals };
}

// ─── ENTRENAMIENTO ────────────────────────────────────────────────────────────
// Detecta sesiones por "SESIÓN X" en col B. Ejercicios: col B=orden, C=nombre, E=reps, F/H/J/L=series
const TRAINING_SHEETS = ['ENTRENAMIENTO S1 - S4', 'ENTRENAMIENTO S5 - S8', 'ENTRENAMIENTO S9 - S12'];

function getTraining() {
  const allSessions = [];
  TRAINING_SHEETS.forEach(sheetName => {
    let sheet;
    try { sheet = getSheet(sheetName); } catch(e) { return; }
    const maxRow = sheet.getLastRow();
    let currentSession = null;

    for (let row = 1; row <= maxRow; row++) {
      const colB = cellVal(sheet, row, 2);
      const colC = cellVal(sheet, row, 3);
      if (!colB && !colC) continue;

      const bStr = String(colB || '').trim();
      const cStr = String(colC || '').trim();

      // Cabecera de sesión
      if (/^SESI[ÓO]N/i.test(bStr)) {
        if (currentSession && currentSession.exercises.length > 0) allSessions.push(currentSession);
        const sessionType = String(cellVal(sheet, row, 4) || '').trim();
        currentSession = { session: bStr, type: sessionType, source: sheetName, exercises: [] };
        continue;
      }
      if (bStr === 'ORDEN' || bStr === 'SEMANA' || !currentSession) continue;

      // Fila de ejercicio: col B es 1-3 chars (letra/número de orden)
      if (cStr && bStr && bStr.length <= 3 && /^[A-Za-z0-9pP]/.test(bStr)) {
        const reps    = String(cellVal(sheet, row, 5)  || '').trim(); // col E
        const series1 = String(cellVal(sheet, row, 6)  || '').trim(); // col F
        const series2 = String(cellVal(sheet, row, 8)  || '').trim(); // col H
        const series3 = String(cellVal(sheet, row, 10) || '').trim(); // col J
        const series4 = String(cellVal(sheet, row, 12) || '').trim(); // col L
        const rir     = String(cellVal(sheet, row, 7)  || '').trim(); // col G
        const video   = cellVal(sheet, row, 4);

        currentSession.exercises.push({
          order:  bStr,
          name:   cStr,
          reps:   reps,
          series: [series1, series2, series3, series4].filter(s => s && s !== '0'),
          rir:    rir,
          video:  video && String(video).startsWith('http') ? String(video) : null,
          isPrep: /^p\d/i.test(bStr)
        });
      }
    }
    if (currentSession && currentSession.exercises.length > 0) allSessions.push(currentSession);
  });
  return { sessions: allSessions };
}


// ─── FIN ────────────────────────────────────────────────────────────────────
