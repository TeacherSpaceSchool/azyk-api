const ItemAzyk = require('../models/itemAzyk');
const AdsAzyk = require('../models/adsAzyk');
const Integrate1CAzyk = require('../models/integrate1CAzyk');
const SubBrandAzyk = require('../models/subBrandAzyk');
const OrganizationAzyk = require('../models/organizationAzyk');
const BasketAzyk = require('../models/basketAzyk');
const mongoose = require('mongoose');
const { saveImage, deleteFile, urlMain, reductionSearch} = require('../module/const');

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
    
    info: String
    size: Float
    reiting: Int
    costPrice: Float
    stock: Float
  }
`;

const query = `
    items(organization: ID, search: String!, sort: String!): [Item]
    itemsTrash(search: String!): [Item]
    brands(organization: ID!, search: String!, sort: String!, city: String): [Item]
    item(_id: ID!): Item
    sortItem: [Sort]
`;

const mutation = `
    addItem( subBrand: ID, categorys: [String]!, city: String!, unit: String, priotiry: Int, apiece: Boolean, packaging: Int!, weight: Float!, name: String!, image: Upload, price: Float!, organization: ID!, hit: Boolean!, latest: Boolean!): Data
    setItem(_id: ID!, subBrand: ID, unit: String, city: String, categorys: [String], priotiry: Int, apiece: Boolean, packaging: Int, weight: Float, name: String, image: Upload, price: Float, organization: ID, hit: Boolean, latest: Boolean): Data
    deleteItem(_id: [ID]!): Data
    restoreItem(_id: [ID]!): Data
    onoffItem(_id: [ID]!): Data
    addFavoriteItem(_id: [ID]!): Data
`;

const resolvers = {
    itemsTrash: async(parent, {search}, {user}) => {
        if('admin'===user.role){
            return await ItemAzyk.find({
                    del: 'deleted',
                    name: {'$regex': reductionSearch(search), '$options': 'i'}
                })
                    .populate({
                        path: 'organization',
                        select: '_id name consignation'
                    })
                    .sort('-priotiry')
                    .lean()
        }
    },
    items: async(parent, {organization, search, sort}, {user}) => {
        if(['admin', 'суперагент', 'экспедитор', 'суперорганизация', 'организация', 'менеджер', 'агент', 'client'].includes(user.role)){
            return await ItemAzyk.find({
                del: {$ne: 'deleted'},
                name: {'$regex': reductionSearch(search), '$options': 'i'},
                ...organization?{organization}:{},
                ...user.organization?{organization: user.organization}:{},
                ...user.city ? {city: user.city} : {},
                ...user.role==='client'?{status: 'active', categorys: user.category}:{}
            })
                .set('hit latest apiece image name price status del _id organization')
                .populate({
                    path: 'organization',
                    select: '_id'
                })
                .sort(sort)
                .lean()
        }
    },
    brands: async(parent, {organization, search, sort, city}, {user}) => {
        if(mongoose.Types.ObjectId.isValid(organization)) {
            let subBrand = await SubBrandAzyk.findOne({_id: organization}).select('organization _id').lean()
            if(subBrand){
                organization = subBrand.organization
                subBrand = subBrand._id
            }
            if(user.organization) organization = user.organization
            let clientSubBrand
            if(user.role === 'client') {
                clientSubBrand = (await OrganizationAzyk.findById(organization).select('clientSubBrand').lean()).clientSubBrand
            }
            const items = await ItemAzyk.find({
                ...subBrand?{subBrand}:clientSubBrand?{subBrand: null}:{},
                ...user.role === 'admin' ? {} : {status: 'active'},
                organization: organization,
                del: {$ne: 'deleted'},
                ...city ? {city: city} : {},
                ...user.city ? {city: user.city} : {},
                ...user.role === 'client' ? {categorys: user.category, city: user.city} : {},
                name: {'$regex': reductionSearch(search), '$options': 'i'},
            })
                .populate({
                    path: 'organization',
                    select: '_id name consignation'
                })
                .sort(sort)
                .lean()
            return items
        }
        else return []

    },
    item: async(parent, {_id}) => {
        if(mongoose.Types.ObjectId.isValid(_id)) {
            return await ItemAzyk.findOne({
                _id: _id,
            })
                .populate({
                    path: 'organization',
                    select: '_id name minimumOrder consignation'
                })
                .lean()
        } else return null
    },
    sortItem: async() => {
        let sort = [
            {
                name: 'Приоритет',
                field: 'priotiry'
            },
            {
                name: 'Цена',
                field: 'price'
            }
        ]
        return sort
    }
};

const resolversMutation = {
    addItem: async(parent, {subBrand, categorys, city, unit, apiece, priotiry, name, image, price, organization, hit, latest, packaging, weight}, {user}) => {
        if(['admin', 'суперорганизация', 'организация'].includes(user.role)){
            let { stream, filename } = await image;
            filename = await saveImage(stream, filename)
            let _object = new ItemAzyk({
                name: name,
                image: urlMain+filename,
                price: price,
                organization: user.organization?user.organization:organization,
                hit: hit,
                categorys: categorys,
                packaging: packaging,
                latest: latest,
                subBrand,
                status: 'active',
                weight: weight,
                priotiry: priotiry,
                unit: unit,
                city: city
            });
            if(apiece!=undefined) _object.apiece = apiece
            await ItemAzyk.create(_object)
        }
        return {data: 'OK'};
    },
    setItem: async(parent, {subBrand, city, unit, categorys, apiece, _id, priotiry, weight, name, image, price, organization, packaging, hit, latest}, {user}) => {
         if(['admin', 'суперорганизация', 'организация'].includes(user.role)) {
            let object = await ItemAzyk.findOne({
                _id: _id,
                ...user.organization?{organization: user.organization}:{},
            })
            if (image) {
                let {stream, filename} = await image;
                await deleteFile(object.image)
                filename = await saveImage(stream, filename)
                object.image = urlMain + filename
            }
            if(city)object.city = city
            if(name)object.name = name
            if(weight!=undefined)object.weight = weight
             object.subBrand = subBrand
            if(price)object.price = price
            if(hit!=undefined)object.hit = hit
            if(latest!=undefined)object.latest = latest
            if(unit)object.unit = unit
            if(packaging)object.packaging = packaging
            if(apiece!=undefined) object.apiece = apiece
            if(priotiry!=undefined) object.priotiry = priotiry
            if(categorys!=undefined) object.categorys = categorys
            if(user.role==='admin'&&organization){
                object.organization = organization;
            }
            await object.save();
        }
        return {data: 'OK'}
    },
    onoffItem: async(parent, { _id }, {user}) => {
        let objects = await ItemAzyk.find({_id: {$in: _id}})
        for(let i=0; i<objects.length; i++){
            if(user.role==='admin'|| (['суперорганизация', 'организация'].includes(user.role)&&user.organization.toString()===objects[i].organization.toString())){
                objects[i].status = objects[i].status==='active'?'deactive':'active'
                await objects[i].save()
                await BasketAzyk.deleteMany({item: {$in: objects[i]._id}})
            }
        }
        return {data: 'OK'}
    },
    deleteItem: async(parent, { _id }, {user}) => {
        if(['admin', 'суперорганизация', 'организация'].includes(user.role)) {
            await ItemAzyk.updateMany({_id: {$in: _id}}, {
                del: 'deleted',
                status: 'deactive'
            })
            let objects = await ItemAzyk.find({_id: {$in: _id}, ...user.organization?{organization: user.organization}:{}})
            for(let i=0; i<objects.length; i++){
                await deleteFile(objects[i].image)
                objects[i].del = 'deleted'
                objects[i].status = 'deactive'
                await objects[i].save()
            }
            objects = await AdsAzyk.find({item: {$in: _id}}).select('image').lean()
            for (let i = 0; i < objects.length; i++) {
                await deleteFile(objects[i].image)
            }
            await AdsAzyk.updateMany({_id: {$in: _id}}, {del: 'deleted'})
            await BasketAzyk.deleteMany({item: {$in: _id}})
            await Integrate1CAzyk.deleteMany({item: {$in: _id}})
        }
        return {data: 'OK'}
    },
    restoreItem: async(parent, { _id }, {user}) => {
        if(user.role==='admin') {
            await ItemAzyk.updateMany({_id: {$in: _id}}, {del: null, status: 'active'})
        }
        return {data: 'OK'}
    }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;