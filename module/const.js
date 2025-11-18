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

const dayStartDefault = 3
module.exports.dayStartDefault = dayStartDefault;

const validMail = mail => /^(([^<>()\[\]\.,;:\s@\"]+(\.[^<>()\[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()\.,;\s@\"]+\.{0,1})+([^<>()\.,;:\s@\"]{2,}|[\d\.]+))$/.test(mail);

const validPhone = phone => /^[+]{1}996[0-9]{9}$/.test(phone);

const isNotTestUser = profile => !profile||!profile.login||!profile.login.toLowerCase().includes('test')

const isTestUser = profile => profile&&profile.login&&profile.login.toLowerCase().includes('test')

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
module.exports.months = [
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

const statsCollection = async collection => await (require(collection)).collection.stats()

module.exports.saveBase64ToFile = base64 => {
    // eslint-disable-next-line no-undef
    return new Promise((resolve) => {
        let filename = `${randomstring.generate(14)}.png`;
        base64 = base64.split(';base64,').pop();
        let filepath = path.join(app.dirname, 'public', 'images', filename)
        fs.writeFile(filepath, base64, {encoding: 'base64'}, function() {
            resolve(`/images/${filename}`)
       });
   })
}

const checkInt = int => {
    if (typeof int === 'string') int = int.replace(/\s+/g, '');
    return isNaN(parseInt(int))?0:parseInt(int)
}

const checkFloat = float => {
    if (typeof float === 'string') float = float.replace(/\s+/g, '');
    float = parseFloat(float)
    return isNaN(float)?0:Math.round(float * 100)/100
}

module.exports.saveFile = (stream, filename) => {
    // eslint-disable-next-line no-undef
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
    // eslint-disable-next-line no-undef
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

module.exports.deleteFile = oldFile => {
    if(oldFile) {
        // eslint-disable-next-line no-undef
        return new Promise(async (resolve) => {
            oldFile = oldFile.replace(urlMain, '')
            oldFile = path.join(app.dirname, 'public', oldFile)
            fs.unlink(oldFile, () => {
                resolve()
           })
       })
   }
}
const pdDDMMYYYY = date =>
{
    date = new Date(date)
    date = `${date.getDate()<10?'0':''}${date.getDate()}.${date.getMonth()<9?'0':''}${date.getMonth()+1}.${date.getFullYear()}`
    return date
}
const pdDDMMYY = date =>
{
    date = new Date(date)
    date = `${date.getDate()<10?'0':''}${date.getDate()}.${date.getMonth()<9?'0':''}${date.getMonth()+1}.${date.getYear()-100}`
    return date
}
const pdDDMMYYHHMM = date => {
    date = new Date(date)
    date = `${date.getDate()<10?'0':''}${date.getDate()}.${date.getMonth()<9?'0':''}${date.getMonth()+1}.${date.getYear()-100} ${date.getHours()<10?'0':''}${date.getHours()}:${date.getMinutes()<10?'0':''}${date.getMinutes()}`
    return date
}
module.exports.pdDDMMHHMM = date => {
    date = new Date(date)
    date = `${date.getDate()<10?'0':''}${date.getDate()}.${date.getMonth()<9?'0':''}${date.getMonth()+1} ${date.getHours()<10?'0':''}${date.getHours()}:${date.getMinutes()<10?'0':''}${date.getMinutes()}`
    return date
}
const pdHHMM = date => {
    date = new Date(date)
    date = `${date.getHours()<10?'0':''}${date.getHours()}:${date.getMinutes()<10?'0':''}${date.getMinutes()}`
    return date
}


const reductionSearch = search => {
    if(search) {
        search = search.trim()
        // Убираем обратные слэши
        search = search.replace(/\\/g, '');
        // Экранируем спецсимволы
        search = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return search
   }
    return ''
}
module.exports.reductionSearch = reductionSearch

module.exports.reductionSearchText = search => {
    if(search) {
        search = reductionSearch(search)
        // Убираем повторяющиеся буквы в поиске
        search = search.replace(/([а-яА-ЯёЁa-zA-Z])\1+/g, '$1');
        // Фонетические подстановки
        const phoneticMap = {
            'о': '[оа]', 'а': '[ао]', 'и': '[ие]', 'у': '[уү]',
            'ү': '[үу]', 'г': '[гґ]', 'к': '[кқ]', 'е': '[еиэ]',
            'э': '[еиэ]', 'в': '[вф]', 'ф': '[вф]',
        };
        // Разбиваем по словам
        const words = search.trim().split(/\s+/);
        // Для каждого слова строим шаблон
        const wordPatterns = words.map(word => {
            let pattern = '';
            for (let i = 0; i < word.length; i++) {
                const c = word[i].toLowerCase();
                const p = phoneticMap[c] || c;
                // буква{1,}? — одна или более, лениво
                if (/[а-яёa-z]/i.test(c)) {
                    pattern += '(?:' + p + '){1,}';
                } else {
                    pattern += p;
                }
            }
            return pattern;
        });
        // Соединяем слова через .* (любые символы между словами)
        return wordPatterns.join('.*');
   }
    return ''
}

module.exports.getDateRange = date => {
    const dateStart = new Date(date)
    if(dateStart.getHours() < dayStartDefault)
        dateStart.setDate(dateStart.getDate() - 1)
    dateStart.setHours(dayStartDefault, 0, 0, 0)
    const dateEnd = new Date(dateStart)
    dateEnd.setDate(dateEnd.getDate() + 1)
    return {dateStart, dateEnd}
}

module.exports.isNotEmpty = value => value !== undefined && value !== null;

module.exports.isEmpty = value => value === undefined || value === null;

module.exports.chunkArray = (array, size) => {
    const result = [];
    for(let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
   }
    return result;
}

module.exports.sendPushToAdmin = async ({title, message}) => {
    const adminUser = await UserAzyk.findOne({role: 'admin'}).select('_id').lean()
    await sendWebPush({title: title, message, users: [adminUser._id]})
}

module.exports.unawaited = func => setTimeout(async () => await func())

module.exports.generateUniqueNumber = async (table, numbers = []) => {
    let number
    do {
        number = randomstring.generate({length: 12, charset: 'numeric'})
   } while (await table.findOne({number}).select('_id').lean()||numbers.includes(number))
    return number
}

module.exports.checkDate = date => {
    const parsed = new Date(date);
    return Number.isNaN(parsed)||parsed=='Invalid Date' ? new Date() : parsed;
};

module.exports.cities = ['Бишкек', 'Баткен', 'Балыкчы', 'Боконбаева', 'Жалал-Абад', 'Кара-Балта', 'Каракол', 'Казарман', 'Кочкор', 'Кызыл-Кия', 'Нарын', 'Ош', 'Раззаков', 'Талас', 'Токмок', 'Чолпон-Ата', 'Москва'];

module.exports.formatErrorDetails = err => err?(err.stack||err.message||JSON.stringify(err)).slice(0, 250):'';

module.exports.formatAmount = amount => amount&&amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009');

module.exports.getClientTitle = client => client&&client.address&&client.address[0]?`${client.address[0][2]}${client.address[0][0]&&client.address[0][2]?', ':''}${client.address[0][0]}`:'';

module.exports.isSameDay = (d1, d2) => {
    return (
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate()
    );
}

module.exports.sum = arr => arr.reduce((a, b) => a + b, 0)

module.exports.isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);

module.exports.defaultLimit = 30;
module.exports.statsCollection = statsCollection;
module.exports.getGeoDistance = getGeoDistance;
module.exports.checkInt = checkInt;
module.exports.pdHHMM = pdHHMM;
module.exports.pdDDMMYY = pdDDMMYY;
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
