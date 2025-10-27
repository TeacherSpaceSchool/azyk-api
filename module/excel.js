const ExcelJS = require('exceljs');
const {urlMain, isObject} = require('./const');
const path = require('path');
const fs = require('fs');
const app = require('../app');

const alphabet = [
    'A','B','C','D','E','F','G','H','I','J','K','L','M',
    'N','O','P','Q','R','S','T','U','V','W','X','Y','Z'
];
const horizontalAlignments = {left: 'left', center: 'center', right: 'right', justify: 'justify'}
const setCell = ({worksheet, data, idx}) => {
    if(!isObject(data)) data = {value: data}
    const  {value, bold, wrap, horizontalAlignment, border} = data
    const cell = worksheet.getCell(idx);
    cell.alignment = { ...cell.alignment, vertical: 'top', horizontal: horizontalAlignment||horizontalAlignments.left}
    if(bold) cell.font = { ...cell.font, bold }
    if(border) cell.border = {top: { style: 'thin', color: { argb: 'FF000000' } }, left: { style: 'thin', color: { argb: 'FF000000' } }, bottom: { style: 'thin', color: { argb: 'FF000000' } }, right: { style: 'thin', color: { argb: 'FF000000' } }}
    if(wrap) cell.alignment = { ...cell.alignment, wrapText: true }
    cell.value = value;

}

module.exports.horizontalAlignments = horizontalAlignments

module.exports.getExcelSheet = async({name, worksheetsData}) => {
    let workbook = new ExcelJS.Workbook();
    for(const worksheetData of worksheetsData) {
        const {name, columnsWidth = {}, rows = []} = worksheetData
        const worksheet = await workbook.addWorksheet(name);
        //pageSetup
        worksheet.pageSetup = {
            fitToPage: true, /*включаем подгонку под страницу*/ fitToWidth: 1, /*помещать по ширине на 1 страницу*/
            fitToHeight: 0, /*не ограничивать по высоте*/ orientation: 'portrait', /*альбомная ориентация*/
            margins: {left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3}
        };
        //columns
        const columnsLength = Math.max(...rows.map(row => row.length));
        for(let i = 0; i < columnsLength; i += 1) {
            const columnIdx = i+1
            worksheet.getColumn(columnIdx).width = columnsWidth[columnIdx]||10;
        }
        //rows
        let rowIdx = 0
        for (const row of rows) {
            rowIdx += 1
            let alphabetIdx = 0
            for (const data of row) {
                setCell({worksheet, data, idx: `${alphabet[alphabetIdx]}${rowIdx}`})
                alphabetIdx += 1
            }
        }
    }
    let xlsxname = `${name}.xlsx`;
    let xlsxdir = path.join(app.dirname, 'public', 'xlsx');
    if (!fs.existsSync(xlsxdir)) {
        await fs.mkdirSync(xlsxdir);
    }
    let xlsxpath = path.join(app.dirname, 'public', 'xlsx', xlsxname);
    await workbook.xlsx.writeFile(xlsxpath);
    return [[urlMain + '/xlsx/' + xlsxname]]

}



