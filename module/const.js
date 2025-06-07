const Jimp = require('jimp');
const randomstring = require('randomstring');
const app = require('../app');
const fs = require('fs');
const path = require('path');
const UserAzyk = require('../models/userAzyk');
const {sendWebPush} = require('./webPush');
const urlMain = `${process.env.URL.trim()}:3000`,
    adminLogin = 'admin',
    skip = 1,
    adminPass = 'hGNSKtmSBG'

const validMail = (mail) => {
    return /^(([^<>()\[\]\.,;:\s@\"]+(\.[^<>()\[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()\.,;\s@\"]+\.{0,1})+([^<>()\.,;:\s@\"]{2,}|[\d\.]+))$/.test(mail);
}
const validPhone = (phone) => {
    return /^[+]{1}996[0-9]{9}$/.test(phone);
}
const isNotTestUser = (profile) => {
    return !profile||!profile.login||!profile.login.toLowerCase().includes('test')
}
const isTestUser = (profile) => {
    return profile&&profile.login&&profile.login.toLowerCase().includes('test')
}
const getGeoDistance = (lat1, lon1, lat2, lon2) => {
    lat1 = parseFloat(lat1)
    lon1 = parseFloat(lon1)
    lat2 = parseFloat(lat2)
    lon2 = parseFloat(lon2)
    let deg2rad = Math.PI / 180;
    lat1 *= deg2rad;
    lon1 *= deg2rad;
    lat2 *= deg2rad;
    lon2 *= deg2rad;
    let diam = 12742000; // Diameter of the earth in km (2 * 6371)
    let dLat = lat2 - lat1;
    let dLon = lon2 - lon1;
    let a = (
        (1 - Math.cos(dLat)) +
        (1 - Math.cos(dLon)) * Math.cos(lat1) * Math.cos(lat2)
    ) / 2;
    return parseInt(diam * Math.asin(Math.sqrt(a)));
}
module.exports.weekDay = [
    'BC',
    'ПН',
    'ВТ',
    'СР',
    'ЧТ',
    'ПТ',
    'СБ',
]
module.exports.month = [
        'январь',
        'февраль',
        'март',
        'апрель',
        'май',
        'июнь',
        'июль',
        'август',
        'сентябрь',
        'октябрь',
        'ноябрь',
        'декабрь'
    ]

module.exports.tomtom = 'waWMYtFJZce2G49GAz0nXJG5Grw3OpNm'

const statsCollection = async (collection) => {
    return (await (require(collection)).collection.stats())
}

module.exports.saveBase64ToFile = (base64) => {
    return new Promise((resolve) => {
        let filename = `${randomstring.generate(14)}.png`;
        base64 = base64.split(';base64,').pop();
        let filepath = path.join(app.dirname, 'public', 'images', filename)
        fs.writeFile(filepath, base64, {encoding: 'base64'}, function() {
            resolve(`/images/${filename}`)
        });
    })
}

const checkInt = (int) => {
    return isNaN(parseInt(int))?0:parseInt(int)
}

const checkFloat = (float) => {
    float = parseFloat(float)
    return isNaN(float)?0:Math.round(float * 10)/10
}

module.exports.saveFile = (stream, filename) => {
    return new Promise((resolve) => {
        filename = `${randomstring.generate(7)}${filename}`;
        let filepath = path.join(app.dirname, 'public', 'images', filename)
        let fstream = fs.createWriteStream(filepath);
        stream.pipe(fstream)
        fstream.on('finish', () => {
            resolve(`/images/${filename}`)
        })
    })
}

module.exports.saveImage = (stream, filename) => {
    return new Promise(async (resolve) => {
        let randomfilename = `${randomstring.generate(7)}${filename}`;
        let filepath = path.join(app.dirname, 'public', 'images', randomfilename)
        let fstream = fs.createWriteStream(filepath);
        stream.pipe(fstream)
        fstream.on('finish', async () => {
            let image = await Jimp.read(filepath)
            if(image.bitmap.width>800||image.bitmap.height>800) {
                randomfilename = `${randomstring.generate(7)}${filename}`;
                let filepathResize = path.join(app.dirname, 'public', 'images', randomfilename)
                image.resize(800, Jimp.AUTO)
                    .quality(80)
                    .write(filepathResize);
                fs.unlink(filepath, ()=>{
                    resolve(`/images/${randomfilename}`)
                })
            }
            else
                resolve(`/images/${randomfilename}`)
        })
    })
}

module.exports.deleteFile = (oldFile) => {
    return new Promise(async (resolve) => {
        oldFile = oldFile.replace(urlMain, '')
        oldFile = path.join(app.dirname, 'public', oldFile)
        fs.unlink(oldFile, ()=>{
            resolve()
        })
    })
}
const pdDDMMYYYY = (date) =>
{
    date = new Date(date)
    date = `${date.getDate()<10?'0':''}${date.getDate()}.${date.getMonth()<9?'0':''}${date.getMonth()+1}.${date.getFullYear()}`
    return date
}
const pdDDMMYY = (date) =>
{
    date = new Date(date)
    date = `${date.getDate()<10?'0':''}${date.getDate()}.${date.getMonth()<9?'0':''}${date.getMonth()+1}.${date.getYear()-100}`
    return date
}
const pdDDMMYYHHMM = (date) =>
{
    date = new Date(date)
    date = `${date.getDate()<10?'0':''}${date.getDate()}.${date.getMonth()<9?'0':''}${date.getMonth()+1}.${date.getFullYear()} ${date.getHours()<10?'0':''}${date.getHours()}:${date.getMinutes()<10?'0':''}${date.getMinutes()}`
    return date
}
const pdHHMM = (date) =>
{
    date = new Date(date)
    date = `${date.getHours()<10?'0':''}${date.getHours()}:${date.getMinutes()<10?'0':''}${date.getMinutes()}`
    return date
}

module.exports.reductionSearch = (search) => {
    if(search) {
        search = search.replace(/\\/g, '')
        search = search.replace(/\(/g, '\\(')
        search = search.replace(/\)/g, '\\)')
        search = search.replace(/\[/g, '\\[')
        search = search.replace(/]/g, '\\]')
        search = search.replace(/\+/g, '\\+')
        search = search.replace(/\*/g, '\\*')
        search = search.replace(/\?/g, '\\?')
        return search
    }
    return ''
}

module.exports.getDateRange = (date) => {
    const dateStart = new Date(date)
    if(dateStart.getHours() < 3)
        dateStart.setDate(dateStart.getDate() - 1)
    dateStart.setHours(3, 0, 0, 0)
    const dateEnd = new Date(dateStart)
    dateEnd.setDate(dateEnd.getDate() + 1)
    return {dateStart, dateEnd}
}

module.exports.isNotEmpty = (value) => {
    return value !== undefined && value !== null;
}

module.exports.chunkArray = (array, size) => {
    const result = [];
    for(let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}

module.exports.sendPushToAdmin = async ({title, message}) => {
    let user = await UserAzyk.findOne({role: 'admin'}).select('_id').lean()
    if(user){
        await sendWebPush({title: title?title:'AZYK.STORE', message, user: user._id})
    }
}

module.exports.cities = ['Бишкек', 'Баткен', 'Балыкчы', 'Боконбаева', 'Жалал-Абад', 'Кара-Балта', 'Каракол', 'Казарман', 'Кочкор', 'Кызыл-Кия', 'Нарын', 'Ош', 'Раззаков', 'Талас', 'Токмок', 'Чолпон-Ата', 'Москва'];

module.exports.statsCollection = statsCollection;
module.exports.getGeoDistance = getGeoDistance;
module.exports.checkInt = checkInt;
module.exports.pdHHMM = pdHHMM;
module.exports.pdDDMMYYYY = pdDDMMYYYY;
module.exports.pdDDMMYYHHMM = pdDDMMYYHHMM;
module.exports.skip = skip;
module.exports.validPhone = validPhone;
module.exports.validMail = validMail;
module.exports.adminPass = adminPass;
module.exports.adminLogin = adminLogin;
module.exports.urlMain = urlMain;
module.exports.checkFloat = checkFloat;
module.exports.isNotTestUser = isNotTestUser;
module.exports.isTestUser = isTestUser;
