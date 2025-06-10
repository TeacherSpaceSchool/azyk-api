const app = require('../app');
const {pdDDMMYYHHMM} = require('../module/const');
const fs = require('fs');
const path = require('path');
const dirs = ['images', 'xlsx']
const { deleteFile, urlMain } = require('../module/const');
const ClientAzyk = require('../models/clientAzyk');
const BlogAzyk = require('../models/blogAzyk');
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
    files(filter: String!): [File]
    filterFile: [Filter]
`;

const mutation = `
    clearAllDeactiveFiles: Data
`;

const resolvers = {
    files: async(parent, {filter}, {user}) => {
        if(user.role==='admin') {
            let data = [], res = [], filesUrl = [], stat, size, createdAt, url
            for (let i = 0; i < dirs.length; i++) {
                url = path.join(app.dirname, 'public', dirs[i])
                const files = fs.readdirSync(url, 'utf8');
                for (let name of files) {
                    url = path.join(app.dirname, 'public', dirs[i], name)
                    stat = fs.statSync(url)
                    createdAt = pdDDMMYYHHMM(stat.atime)
                    size = Math.round((stat.size/1000000) * 1000)/1000;
                    data.push({name, size, url: dirs[i], createdAt});
                    filesUrl.push(`${urlMain}/${dirs[i]}/${name}`)
                }
            }
            res = [
                ...(await ClientAzyk.find({image: {$in: filesUrl}}).select('name image').lean()).map(element=>{return {...element, type: 'Клиент'}}),
                ...(await BlogAzyk.find({image: {$in: filesUrl}}).select('title image').lean()).map(element=>{return {...element, name: element.title, type: 'Блог'}}),
                ...(await ContactAzyk.find({image: {$in: filesUrl}}).select('image').lean()).map(element=>{return {...element, name: 'Azyk.Store', type: 'Контакты'}}),
                ...(await AdsAzyk.find({image: {$in: filesUrl}}).select('title image').lean()).map(element=>{return {...element, name: element.title, type: 'Акция'}}),
                ...(await OrganizationAzyk.find({image: {$in: filesUrl}}).select('name image').lean()).map(element=>{return {...element, type: 'Организация'}}),
                ...(await ItemAzyk.find({image: {$in: filesUrl}}).select('name image').lean()).map(element=>{return {...element, type: 'Товар'}}),
                ...(await FaqAzyk.find({url: {$in: filesUrl}}).select('title url').lean()).map(element=>{return {...element, name: element.title, type: 'Инструкция'}}),
                ...(await EquipmentAzyk.find({image: {$in: filesUrl}}).select('name image').lean()).map(element=>{return {...element, type: 'Оборудование'}}),
                ...(await SubBrandAzyk.find({image: {$in: filesUrl}}).select('name image').lean()).map(element=>{return {...element, type: 'Подбренд'}}),
            ]
            filesUrl = {}
            for (let i = 0; i < res.length; i++) {
                filesUrl[res[i].image?res[i].image:res[i].url?res[i].url:'lol'] = res[i]
            }
            res = []
            let fileUrl
            for (let i = 0; i < data.length; i++) {
                fileUrl = filesUrl[`${urlMain}/${data[i].url}/${data[i].name}`]
                data[i].active = fileUrl ? 'активен' : 'неактивен'
                data[i].owner = fileUrl? `${fileUrl.type} ${fileUrl.name}`: 'Отсутствует'
                if(!filter.length||(filter==='active'&&fileUrl)||(filter==='deactive'&&!fileUrl))
                    res.push(data[i])
            }
            res = res.sort(function (a, b) {
                return b.size - a.size
            });
            return res;
        }
    },
    filterFile: async(parent, ctx, {user}) => {
        let filter = [
            {
                name: 'Все',
                value: ''
            },
            {
                name: 'Активные',
                value: 'active'
            },
            {
                name: 'Неактивные',
                value: 'deactive'
            }
        ]
        if(user.role)
            filter.push()
        return filter
    },
};

const resolversMutation = {
    clearAllDeactiveFiles: async(parent, ctx, {user}) => {
        if('admin'===user.role){
            let data = [], url
            for (let i = 0; i < dirs.length; i++) {
                url = path.join(app.dirname, 'public', dirs[i])
                const files = fs.readdirSync(url, 'utf8');
                for (let name of files) {
                    data.push(`${urlMain}/${dirs[i]}/${name}`)
                }
            }
            let filesUrl = [
                ...(await ClientAzyk.find({image: {$in: data}}).distinct('image').lean()),
                ...(await BlogAzyk.find({image: {$in: data}}).distinct('image').lean()),
                ...(await ContactAzyk.find({image: {$in: data}}).distinct('image').lean()),
                ...(await AdsAzyk.find({image: {$in: data}}).distinct('image').lean()),
                ...(await OrganizationAzyk.find({image: {$in: data}}).distinct('image').lean()),
                ...(await ItemAzyk.find({image: {$in: data}}).distinct('image').lean()),
                ...(await FaqAzyk.find({url: {$in: data}}).distinct('url').lean()),
                ...(await EquipmentAzyk.find({image: {$in: data}}).distinct('image').lean()),
                ...(await SubBrandAzyk.find({image: {$in: data}}).distinct('image').lean()),
            ]
            for (let i = 0; i < data.length; i++) {
                if(!filesUrl.includes(data[i]))
                    await deleteFile(data[i])
            }
        }
        return {data: 'OK'}
    }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;