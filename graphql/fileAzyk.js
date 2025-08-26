const app = require('../app');
const {pdDDMMYY} = require('../module/const');
const fs = require('fs');
const path = require('path');
const dirs = ['images', 'xlsx']
const {deleteFile, urlMain} = require('../module/const');
const ClientAzyk = require('../models/clientAzyk');
const ContactAzyk = require('../models/contactAzyk');
const AdsAzyk = require('../models/adsAzyk');
const OrganizationAzyk = require('../models/organizationAzyk');
const ItemAzyk = require('../models/itemAzyk');
const FaqAzyk = require('../models/faqAzyk');
const EquipmentAzyk = require('../models/equipmentAzyk');
const SubBrandAzyk = require('../models/subBrandAzyk');

const type = `
  type File {
    name: String
    url: String
    size: Float
    createdAt: String
    active: String
    owner: String
 }
`;

const query = `
    files: [File]
`;

const mutation = `
    clearAllDeactiveFiles: String
`;

const resolvers = {
    files: async(parent, args, {user}) => {
        if(user.role==='admin') {
            let data = [], res = [], filesUrl = [], stat, size, createdAt, url
            for(let i = 0; i < dirs.length; i++) {
                url = path.join(app.dirname, 'public', dirs[i])
                const files = fs.readdirSync(url, 'utf8');
                for(let name of files) {
                    url = path.join(app.dirname, 'public', dirs[i], name)
                    stat = fs.statSync(url)
                    createdAt = pdDDMMYY(stat.atime)
                    size = Math.round((stat.size/1000000) * 1000)/1000;
                    data.push({name, size, url: dirs[i], createdAt});
                    filesUrl.push(`${urlMain}/${dirs[i]}/${name}`)
               }
           }
            // eslint-disable-next-line no-undef
            const [client, contact, ads, organization, item, faq, equipment, subBrand] = await Promise.all([
                ClientAzyk.find({image: {$in: filesUrl}}).select('name image').lean(),
                ContactAzyk.find({image: {$in: filesUrl}}).select('image').lean(),
                AdsAzyk.find({image: {$in: filesUrl}}).select('title image').lean(),
                OrganizationAzyk.find({image: {$in: filesUrl}}).select('name image').lean(),
                ItemAzyk.find({image: {$in: filesUrl}}).select('name image').lean(),
                FaqAzyk.find({url: {$in: filesUrl}}).select('title url').lean(),
                EquipmentAzyk.find({image: {$in: filesUrl}}).select('name image').lean(),
                SubBrandAzyk.find({image: {$in: filesUrl}}).select('name image').lean()
            ])
            res = [
                ...client.map(element=>{return {...element, type: 'Клиент'}}),
                ...contact.map(element=>{return {...element, name: 'Azyk.Store', type: 'Контакты'}}),
                ...ads.map(element=>{return {...element, name: element.title, type: 'Акция'}}),
                ...organization.map(element=>{return {...element, type: 'Организация'}}),
                ...item.map(element=>{return {...element, type: 'Товар'}}),
                ...faq.map(element=>{return {...element, name: element.title, type: 'Инструкция'}}),
                ...equipment.map(element=>{return {...element, type: 'Оборудование'}}),
                ...subBrand.map(element=>{return {...element, type: 'Подбренд'}}),
            ]
            filesUrl = {}
            for(let i = 0; i < res.length; i++) {
                filesUrl[res[i].image?res[i].image:res[i].url?res[i].url:'lol'] = res[i]
           }
            res = []
            let fileUrl
            for(let i = 0; i < data.length; i++) {
                fileUrl = filesUrl[`${urlMain}/${data[i].url}/${data[i].name}`]
                data[i].active = fileUrl ? 'активен' : 'неактивен'
                data[i].owner = fileUrl? `${fileUrl.type} ${fileUrl.name}`: 'Отсутствует'
                res.push(data[i])
           }
            res = res.sort(function (a, b) {
                return b.size - a.size
           });
            return res;
       }
   },
};

const resolversMutation = {
    clearAllDeactiveFiles: async(parent, ctx, {user}) => {
        if(user.role==='admin') {
            let data = [], url
            for(let i = 0; i < dirs.length; i++) {
                url = path.join(app.dirname, 'public', dirs[i])
                const files = fs.readdirSync(url, 'utf8');
                for(let name of files) {
                    data.push(`${urlMain}/${dirs[i]}/${name}`)
               }
           }
            // eslint-disable-next-line no-undef
            const [client, contact, ads, organization, item, faq, equipment, subBrand] = await Promise.all([
                ClientAzyk.find({image: {$in: data}}).distinct('image'),
                ContactAzyk.find({image: {$in: data}}).distinct('image'),
                AdsAzyk.find({image: {$in: data}}).distinct('image'),
                OrganizationAzyk.find({image: {$in: data}}).distinct('image'),
                ItemAzyk.find({image: {$in: data}}).distinct('image'),
                FaqAzyk.find({url: {$in: data}}).distinct('url'),
                EquipmentAzyk.find({image: {$in: data}}).distinct('image'),
                SubBrandAzyk.find({image: {$in: data}}).distinct('image')
            ])
            let filesUrl = [
                ...client, ...contact, ...ads, ...organization, ...item, ...faq, ...equipment, ...subBrand]
            for(let i = 0; i < data.length; i++) {
                if(!filesUrl.includes(data[i]))
                    await deleteFile(data[i])
           }
       }
        return 'OK'
   }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;