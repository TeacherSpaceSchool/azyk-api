const ItemAzyk = require('../models/itemAzyk');
const {urlMain} = require('./const');
const path = require('path');
const ExcelJS = require('exceljs');
const randomstring = require('randomstring');
const fs = require('fs');
const Integrate1CAzyk = require('../models/integrate1CAzyk');

module.exports.reductionXlsx = () => {
    setTimeout(async () => {
        let workbook = new ExcelJS.Workbook();
        let data = await ItemAzyk.find({
            organization: '60367cfb3aa2070f708b5296',
            del: {$ne: 'deleted'}
        }).lean()
        let worksheet;
        worksheet = await workbook.addWorksheet('Товары');
        for(let i = 0; i<data.length;i++){
            let integrate1CAzyk = await Integrate1CAzyk.findOne({
                organization: '60367cfb3aa2070f708b5296',
                item: data[i]._id,
            }).select('guid').lean()
            worksheet.addRow([
                integrate1CAzyk.guid,
                data[i].name,
                data[i].price,
                data[i].packaging,
                data[i].weight,
                1
            ]);
        }
        let xlsxname = `${randomstring.generate(20)}.xlsx`;
        const dirname = __dirname.replace('\\module', '')
        console.log(dirname)
        let xlsxdir = path.join(dirname, 'public', 'xlsx');
        if (!await fs.existsSync(xlsxdir)){
            await fs.mkdirSync(xlsxdir);
        }
        let xlsxpath = path.join(dirname, 'public', 'xlsx', xlsxname);
        await workbook.xlsx.writeFile(xlsxpath);
        console.log({data: urlMain + '/xlsx/' + xlsxname})
    }, 10000)

}