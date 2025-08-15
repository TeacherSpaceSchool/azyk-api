const ItemAzyk = require('../models/itemAzyk');
const AdsAzyk = require('../models/adsAzyk');
const Integrate1CAzyk = require('../models/integrate1CAzyk');
const SubBrandAzyk = require('../models/subBrandAzyk');
const BasketAzyk = require('../models/basketAzyk');
const mongoose = require('mongoose');
const {saveImage, deleteFile, urlMain, reductionSearchText, isNotEmpty, unawaited} = require('../module/const');
const {addHistory, historyTypes} = require('../module/history');

// OLD
// stock: Float

const type = `
  type Item {
    _id: ID
    unit: String
    createdAt: Date
    name: String
    categorys: [String]
    image: String
    price: Float
    subBrand: SubBrand
    organization: Organization
    hit: Boolean
    latest: Boolean
    apiece: Boolean
    status: String
    packaging: Int
    weight: Float
    priotiry: Int
    del: String
    city: String
    
    subCategory: SubCategory
    info: String
    size: Float
    reiting: Int
    costPrice: Float
    stock: Float
 }
`;

const query = `
    items(organization: ID, search: String!): [Item]
    brands(organization: ID!, search: String!, city: String): [Item]
    item(_id: ID!): Item
`;

const mutation = `
    addItem( subBrand: ID, categorys: [String]!, city: String!, unit: String, priotiry: Int, apiece: Boolean, packaging: Int!, weight: Float!, name: String!, image: Upload, price: Float!, organization: ID!, hit: Boolean!, latest: Boolean!): ID
    setItem(_id: ID!, subBrand: ID, unit: String, city: String, categorys: [String], priotiry: Int, apiece: Boolean, packaging: Int, weight: Float, name: String, image: Upload, price: Float, organization: ID, hit: Boolean, latest: Boolean): String
    deleteItem(_id: ID!): String
    onoffItem(_id: ID!): String
`;

const resolvers = {
    items: async(parent, {organization, search}, {user}) => {
        if(['admin', 'суперагент', 'экспедитор', 'суперорганизация', 'организация', 'менеджер', 'агент', 'client'].includes(user.role)) {
            organization = user.organization||organization
            return await ItemAzyk.find({
                del: {$ne: 'deleted'},
                name: {$regex: reductionSearchText(search), $options: 'i'},
                ...organization?{organization}:{},
                ...user.city ? {city: user.city} : {},
                ...user.role==='client'?{status: 'active', categorys: user.category}:{}
            })
                .sort('-priotiry name')
                .populate({
                    path: 'subBrand',
                    select: '_id name'
                })
                .lean()
        }
    },
    brands: async(parent, {organization, search, city}, {user}) => {
        if(mongoose.Types.ObjectId.isValid(organization)) {
            //если подбренд
            let subBrand = await SubBrandAzyk.findById(organization).select('organization _id').lean()
            if(subBrand) {
                organization = subBrand.organization
                subBrand = subBrand._id
            }
            //организация сотрудника
            if(user.organization) organization = user.organization
            //если у пользователя город
            if(user.city) city = user.city
            //поиск
            const res = await ItemAzyk.find({
                ...subBrand?{subBrand}:{},
                ...user.role === 'admin' ? {} : {status: 'active'},
                organization,
                del: {$ne: 'deleted'},
                ...city ? {city} : {},
                ...user.role === 'client' ? {categorys: user.category} : {},
                ...search?{name: {$regex: reductionSearchText(search), $options: 'i'}}:{}
            })
                .sort('-priotiry name')
                .lean()
            return res
        }
        else return []

    },
    item: async(parent, {_id}) => {
        if(mongoose.Types.ObjectId.isValid(_id)) {
            return ItemAzyk.findOne({
                _id,
            })
                .populate({
                    path: 'organization',
                    select: '_id name minimumOrder'
                })
                .populate({
                    path: 'subBrand',
                    select: '_id name'
                })
                .lean()
        } else return null
    }
};

const resolversMutation = {
    addItem: async(parent, {subBrand, categorys, city, unit, apiece, priotiry, name, image, price, organization, hit, latest, packaging, weight}, {user}) => {
        if(['admin', 'суперорганизация', 'организация'].includes(user.role)) {
            let {stream, filename} = await image;
            image = urlMain + await saveImage(stream, filename)
            const createdObject = await ItemAzyk.create({
                name,
                image,
                price,
                organization: user.organization||organization,
                hit,
                categorys,
                packaging,
                latest,
                subBrand,
                status: 'active',
                weight,
                priotiry,
                unit,
                city,
                ...isNotEmpty(apiece)?{apiece}:{}
            })
            unawaited(() => addHistory({user, type: historyTypes.create, model: 'ItemAzyk', name, object: createdObject._id}))
            return createdObject._id
        }
    },
    setItem: async(parent, {subBrand, city, unit, categorys, apiece, _id, priotiry, weight, name, image, price, organization, packaging, hit, latest}, {user}) => {
        if(['admin', 'суперорганизация', 'организация'].includes(user.role)) {
            let object = await ItemAzyk.findOne({
                _id,
                ...user.organization?{organization: user.organization}:{},
            })
            unawaited(() => addHistory({user, type: historyTypes.set, model: 'ItemAzyk', name: object.name, object: _id, data: {subBrand, city, unit, categorys, apiece, priotiry, weight, name, image, price, organization, packaging, hit, latest}}))
            if (image) {
                let {stream, filename} = await image;
                // eslint-disable-next-line no-undef
                const [savedFilename] = await Promise.all([
                    saveImage(stream, filename),
                    deleteFile(object.image)
                ])
                object.image = urlMain + savedFilename
            }
            if(city)object.city = city
            if(name)object.name = name
            if(isNotEmpty(weight))object.weight = weight
            object.subBrand = subBrand
            if(price)object.price = price
            if(isNotEmpty(hit))object.hit = hit
            if(isNotEmpty(latest))object.latest = latest
            if(unit)object.unit = unit
            if(packaging)object.packaging = packaging
            if(isNotEmpty(apiece)) object.apiece = apiece
            if(isNotEmpty(priotiry)) object.priotiry = priotiry
            if(isNotEmpty(categorys)) object.categorys = categorys
            if(user.role==='admin'&&organization) {
                object.organization = organization;
            }
            await object.save();
            return 'OK'
        }
    },
    onoffItem: async(parent, {_id}, {user}) => {
        if(['admin', 'суперорганизация', 'организация'].includes(user.role)) {
            const item = await ItemAzyk.findOne({_id, ...user.organization?{organization: user.organization}:{}}).select('name status').lean()
            const newStatus = item.status === 'active' ? 'deactive' : 'active'
            // eslint-disable-next-line no-undef
            await Promise.all([
                ItemAzyk.updateOne({_id, ...user.organization?{organization: user.organization}:{}}, {status: newStatus}),
                BasketAzyk.deleteMany({item: item._id})
            ])

            unawaited(() => addHistory({user, type: historyTypes.set, model: 'ItemAzyk', name: item.name, object: _id, data: {status: newStatus}}))

            return 'OK'
        }
    },
    deleteItem: async(parent, {_id}, {user}) => {
        if(['admin', 'суперорганизация', 'организация'].includes(user.role)) {
            // eslint-disable-next-line no-undef
            const [item, adss] = await Promise.all([
                ItemAzyk.findOne({_id, ...user.organization?{organization: user.organization}:{}}).select('name image').lean(),
                AdsAzyk.find({item: _id, ...user.organization?{organization: user.organization}:{}}).select('image').lean(),
                ItemAzyk.updateOne({_id, ...user.organization?{organization: user.organization}:{}}, {del: 'deleted', status: 'deactive'}),
                AdsAzyk.updateMany({item: _id, ...user.organization?{organization: user.organization}:{}}, {del: 'deleted'}),
                BasketAzyk.deleteMany({item: _id, ...user.organization?{organization: user.organization}:{}}),
                Integrate1CAzyk.deleteMany({item: _id, ...user.organization?{organization: user.organization}:{}})
            ])
            await deleteFile(item.image)
            // eslint-disable-next-line no-undef
            await Promise.all(adss.map(ads => deleteFile(ads.image)))

            unawaited(() => addHistory({user, type: historyTypes.delete, model: 'ItemAzyk', name: item.name, object: _id}))

            return 'OK'
        }
    }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;