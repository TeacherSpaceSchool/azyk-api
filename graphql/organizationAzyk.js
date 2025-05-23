const mongoose = require('mongoose');
const OrganizationAzyk = require('../models/organizationAzyk');
const AutoAzyk = require('../models/autoAzyk');
const RepairEquipmentAzyk = require('../models/repairEquipmentAzyk');
const EmploymentAzyk = require('../models/employmentAzyk');
const SubBrandAzyk = require('../models/subBrandAzyk');
const DeliveryDateAzyk = require('../models/deliveryDateAzyk');
const DistributerAzyk = require('../models/distributerAzyk');
const DistrictAzyk = require('../models/districtAzyk');
const Integrate1CAzyk = require('../models/integrate1CAzyk');
const AgentRouteAzyk = require('../models/agentRouteAzyk');
const ItemAzyk = require('../models/itemAzyk');
const BasketAzyk = require('../models/basketAzyk');
const UserAzyk = require('../models/userAzyk');
const AdsAzyk = require('../models/adsAzyk');
const PlanAzyk = require('../models/planAzyk');
const ModelsErrorAzyk = require('../models/errorAzyk');
const { saveImage, saveFile, deleteFile, urlMain, isTestUser, isNotTestUser, reductionSearch} = require('../module/const');

const type = `
  type Organization {
    _id: ID
    createdAt: Date
    name: String
    address: [String]
    email: [String]
    phone: [String]
    info: String
    miniInfo: String
    catalog: String
    reiting: Int
    agentHistory: Int
    status: String
    type: String
    image: String
    warehouse: String
    minimumOrder: Int
    accessToClient: Boolean
    unite: Boolean
    agentSubBrand: Boolean
    addedClient: Boolean
    superagent: Boolean
    consignation: Boolean
    refusal: Boolean
    onlyDistrict: Boolean
    dateDelivery: Boolean
    onlyIntegrate: Boolean
    autoAcceptAgent: Boolean
    autoAcceptNight: Boolean
    divideBySubBrand: Boolean
    clientDuplicate: Boolean
    calculateStock: Boolean
    cities: [String]
    del: String
    priotiry: Int
    pass: String
    autoIntegrate: Boolean
  }
`;

const query = `
    brandOrganizations(search: String!, filter: String!, city: String): [Organization]
    organizations(search: String!, filter: String!, city: String): [Organization]
    organizationsTrash(search: String!): [Organization]
    organization(_id: ID!): Organization
    filterOrganization: [Filter]
`;

const mutation = `
    addOrganization(cities: [String]!, autoIntegrate: Boolean!, catalog: Upload, pass: String, warehouse: String!, miniInfo: String!, priotiry: Int, minimumOrder: Int, agentHistory: Int, image: Upload!, name: String!, address: [String]!, email: [String]!, phone: [String]!, info: String!, accessToClient: Boolean!, consignation: Boolean!, refusal: Boolean!, addedClient: Boolean!, agentSubBrand: Boolean!, unite: Boolean!, superagent: Boolean!, onlyDistrict: Boolean!, dateDelivery: Boolean!, onlyIntegrate: Boolean!, autoAcceptAgent: Boolean!, autoAcceptNight: Boolean!, clientDuplicate: Boolean!, calculateStock: Boolean!, divideBySubBrand: Boolean!): Data
    setOrganization(cities: [String], pass: String, autoIntegrate: Boolean, catalog: Upload, warehouse: String, miniInfo: String, _id: ID!, priotiry: Int, minimumOrder: Int, agentHistory: Int, image: Upload, name: String, address: [String], email: [String], phone: [String], info: String, accessToClient: Boolean, consignation: Boolean, refusal: Boolean, addedClient: Boolean, agentSubBrand: Boolean, unite: Boolean, superagent: Boolean, onlyDistrict: Boolean, dateDelivery: Boolean, onlyIntegrate: Boolean, autoAcceptAgent: Boolean, autoAcceptNight: Boolean, clientDuplicate: Boolean, calculateStock: Boolean, divideBySubBrand: Boolean): Data
    restoreOrganization(_id: [ID]!): Data
    deleteOrganization(_id: [ID]!): Data
    onoffOrganization(_id: [ID]!): Data
`;

const resolvers = {
    brandOrganizations: async(parent, {search, filter, city}, {user}) => {
        if(['admin', 'экспедитор', 'суперорганизация', 'организация', 'менеджер', 'агент', 'суперагент', 'суперэкспедитор', 'client'].includes(user.role)){
            let organizationsRes = [], subBrands = [], onlyIntegrate, onlyDistrict, organizationId
            let brandOrganizations = await ItemAzyk.find({
                ...user.role==='admin'?{}:{status: 'active'},
                del: {$ne: 'deleted'}
            }).select('organization subBrand').lean()
            subBrands = brandOrganizations.map(elem=>elem.subBrand)
            brandOrganizations = brandOrganizations.map(elem=>{
                if(user.role!=='client'||!elem.subBrand) return elem.organization
            })
            if(user.organization){
                brandOrganizations = await DistributerAzyk.findOne({
                    distributer: user.organization
                }).distinct('sales').lean()
                brandOrganizations = [...brandOrganizations, user.organization]
            }
            const organizations = await OrganizationAzyk.find({
                _id: {$in: brandOrganizations},
                name: {'$regex': reductionSearch(search), '$options': 'i'},
                status: (isTestUser(user)||'admin'===user.role)?filter.length===0?{'$regex': filter, '$options': 'i'}:filter:'active',
                ...city?{cities: city}:{},
                del: {$ne: 'deleted'},
                ...['суперагент', 'суперэкспедитор'].includes(user.role)?{superagent: true}:{},
                ...user.city?{cities: user.city}:{}
            })
                .select('name autoAcceptAgent _id image miniInfo unite onlyIntegrate onlyDistrict priotiry catalog')
                .sort('-priotiry')
                .lean()
            subBrands = await SubBrandAzyk.find({
                _id: {$in: subBrands},
                name: {'$regex': reductionSearch(search), '$options': 'i'},
                status: (isTestUser(user)||'admin'===user.role)?filter.length===0?{'$regex': filter, '$options': 'i'}:filter:'active',
                ...city?{cities: city}:{},
                del: {$ne: 'deleted'},
                ...user.city?{cities: user.city}:{},
                /*?*/...user.organization?{organization: user.organization}:{}
            })
                .populate({
                    path: 'organization',
                    select: 'onlyIntegrate onlyDistrict _id unite autoAcceptAgent'
                })
                .sort('-priotiry')
                .lean()
            for(let i = 0; i<subBrands.length;i++){
                subBrands[i].type = 'subBrand'
                subBrands[i].unite = subBrands[i].organization.unite
                subBrands[i].autoAcceptAgent = subBrands[i].organization.autoAcceptAgent
            }
            organizationsRes = [...subBrands, ...organizations]
            organizationsRes = organizationsRes.sort(function (a, b) {
                return b.priotiry - a.priotiry
            });
            if(user.role==='client') {
                for (let i = 0; i < organizationsRes.length; i++) {
                    onlyIntegrate =  organizationsRes[i].organization?organizationsRes[i].organization.onlyIntegrate:organizationsRes[i].onlyIntegrate
                    onlyDistrict = organizationsRes[i].organization?organizationsRes[i].organization.onlyDistrict:organizationsRes[i].onlyDistrict
                    organizationId = organizationsRes[i].organization?organizationsRes[i].organization._id:organizationsRes[i]._id
                    if (onlyIntegrate && onlyDistrict) {
                        let district = await DistrictAzyk.findOne({
                            client: user.client,
                            organization: organizationId
                        }).select('_id').lean()
                        let integrate = await Integrate1CAzyk.findOne({
                            client: user.client,
                            organization: organizationId
                        }).select('_id').lean()
                        if(!integrate||!district) {
                            organizationsRes.splice(i, 1)
                            i -= 1
                        }
                    }
                    else if (onlyDistrict) {
                        let district = await DistrictAzyk.findOne({
                            client: user.client,
                            organization: organizationId
                        }).select('_id').lean()
                        if (!district) {
                            organizationsRes.splice(i, 1)
                            i -= 1
                        }
                    }
                    else if (onlyIntegrate) {
                        let integrate = await Integrate1CAzyk.findOne({
                            client: user.client,
                            organization: organizationId
                        }).select('_id').lean()
                        if (!integrate) {
                            organizationsRes.splice(i, 1)
                            i -= 1
                        }
                    }
                }
            }
            return organizationsRes
        }
    },
    organizations: async(parent, {search, filter, city}, {user}) => {
        return await OrganizationAzyk.find({
            name: {'$regex': reductionSearch(search), '$options': 'i'},
            ...(isNotTestUser(user)&&user.role!=='admin')?{status:'active'}:filter.length?{status: filter}:{},
            ...city?{cities: city}:{},
            del: {$ne: 'deleted'}
        })
            .select('name _id image miniInfo')
            .sort('-priotiry')
            .lean()
    },
    organizationsTrash: async(parent, {search}, {user}) => {
        if(user.role==='admin'){
            return await OrganizationAzyk.find({
                name: {'$regex': reductionSearch(search), '$options': 'i'},
                del: 'deleted'
            })
                .select('name _id image miniInfo')
                .sort('-createdAt')
                .lean()
        }
    },
    organization: async(parent, {_id}) => {
        if(mongoose.Types.ObjectId.isValid(_id)) {
            let subBrand = await SubBrandAzyk.findOne({_id: _id}).select('organization name minimumOrder').lean()
            let organization = await OrganizationAzyk.findOne({
                _id: subBrand?subBrand.organization:_id
            })
                .lean()
            if(subBrand) {
                organization.name = `${subBrand.name} (${organization.name})`
                if(subBrand.minimumOrder) organization.minimumOrder = subBrand.minimumOrder
            }
            return organization
        }
    },
    filterOrganization: async(parent, ctx, {user}) => {
        if(user.role==='admin')
            return await [
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
        else
            return await []
    },
};

const resolversMutation = {
    addOrganization: async(parent, {cities, autoIntegrate, catalog, addedClient, agentSubBrand, autoAcceptAgent, autoAcceptNight, clientDuplicate, calculateStock, divideBySubBrand, dateDelivery, pass, warehouse, superagent, unite, miniInfo, priotiry, info, phone, email, address, image, name, minimumOrder, agentHistory, accessToClient, consignation, refusal, onlyDistrict, onlyIntegrate}, {user}) => {
        if(user.role==='admin'){
            let { stream, filename } = await image;
            filename = await saveImage(stream, filename)
            let objectOrganization = new OrganizationAzyk({
                image: urlMain+filename,
                name: name,
                status: 'active',
                address: address,
                email: email,
                phone: phone,
                info: info,
                minimumOrder: minimumOrder,
                reiting: 0,
                accessToClient: accessToClient,
                consignation: consignation,
                refusal: refusal,
                priotiry: priotiry,
                onlyDistrict: onlyDistrict,
                unite: unite,
                superagent: superagent,
                onlyIntegrate: onlyIntegrate,
                miniInfo: miniInfo,
                warehouse: warehouse,
                cities: cities,
                autoAcceptAgent,
                autoAcceptNight,
                clientDuplicate,
                calculateStock,
                divideBySubBrand,
                dateDelivery,
                addedClient,
                agentSubBrand,
                autoIntegrate,
                agentHistory
            });
            if(catalog){
                let { stream, filename } = await catalog;
                objectOrganization.catalog = urlMain+(await saveFile(stream, filename))
            }
            if(pass)
                objectOrganization.pass = pass
            objectOrganization = await OrganizationAzyk.create(objectOrganization)
        }
        return {data: 'OK'};
    },
    setOrganization: async(parent, {catalog, cities, addedClient, agentSubBrand, autoIntegrate, dateDelivery, autoAcceptAgent, autoAcceptNight, clientDuplicate, calculateStock, divideBySubBrand, pass, warehouse, miniInfo, superagent, unite, _id, priotiry, info, phone, email, address, image, name, minimumOrder, agentHistory, accessToClient, refusal, consignation, onlyDistrict, onlyIntegrate}, {user}) => {
        if(user.role==='admin'||(['суперорганизация', 'организация'].includes(user.role)&&user.organization.toString()===_id.toString())) {
            let object = await OrganizationAzyk.findById(_id)
            if (image) {
                let {stream, filename} = await image;
                await deleteFile(object.image)
                filename = await saveImage(stream, filename)
                object.image = urlMain + filename
            }
            if(catalog){
                if(object.catalog)
                    await deleteFile(object.catalog)
                let { stream, filename } = await catalog;
                object.catalog = urlMain+(await saveFile(stream, filename))
            }
            if(user.role==='admin'&&pass!==undefined) object.pass = pass
            if(cities) object.cities = cities
            if(name) object.name = name
            if(info) object.info = info
            if(phone) object.phone = phone
            if(email) object.email = email
            if(address) object.address = address
            if(warehouse) object.warehouse = warehouse
            if(superagent!=undefined) object.superagent = superagent
            if(unite!=undefined) object.unite = unite
            if(onlyDistrict!=undefined) object.onlyDistrict = onlyDistrict
            if(autoAcceptAgent!=undefined) object.autoAcceptAgent = autoAcceptAgent
            if(clientDuplicate!=undefined) object.clientDuplicate = clientDuplicate
            if(calculateStock!=undefined) object.calculateStock = calculateStock
            if(autoAcceptNight!=undefined) {
                let _object = new ModelsErrorAzyk({
                    err: `autoAcceptNight: ${object.autoAcceptNight} => ${autoAcceptNight}`,
                    path: 'setOrganization'
                });
                ModelsErrorAzyk.create(_object)
                object.autoAcceptNight = autoAcceptNight
            }
            if(divideBySubBrand!=undefined) object.divideBySubBrand = divideBySubBrand
            if(dateDelivery!=undefined) object.dateDelivery = dateDelivery
            if(onlyIntegrate!=undefined) object.onlyIntegrate = onlyIntegrate
            if(priotiry!=undefined) object.priotiry = priotiry
            if(consignation!=undefined) object.consignation = consignation
            if(refusal!=undefined) object.refusal = refusal
            if(accessToClient!=undefined) object.accessToClient = accessToClient
            if(minimumOrder!=undefined) object.minimumOrder = minimumOrder
            if(miniInfo!=undefined) object.miniInfo = miniInfo
            if(addedClient!=undefined) object.addedClient = addedClient
            if(agentSubBrand!=undefined) object.agentSubBrand = agentSubBrand
            if(autoIntegrate!=undefined) object.autoIntegrate = autoIntegrate
            if(agentHistory!=undefined) object.agentHistory = agentHistory
            await object.save();
        }
        return {data: 'OK'}
    },
    restoreOrganization: async(parent, { _id }, {user}) => {
        if(user.role==='admin'){
            await OrganizationAzyk.updateMany({_id: {$in: _id}}, {del: null, status: 'active'})
        }
        return {data: 'OK'}
    },
    deleteOrganization: async(parent, { _id }, {user}) => {
        if(user.role==='admin'){
            for(let i=0; i<_id.length; i++) {
                let items = await ItemAzyk.find({organization: _id[i]}).distinct('_id').lean()
                await BasketAzyk.deleteMany({item: {$in: items}})
                await ItemAzyk.updateMany({organization: _id[i]}, {del: 'deleted', status: 'deactive'})
                let users = await EmploymentAzyk.find({organization: _id[i]}).distinct('user').lean()
                await UserAzyk.updateMany({_id: {$in: users}}, {status: 'deactive'})
                await EmploymentAzyk.updateMany({organization: _id[i]}, {del: 'deleted'})
                await SubBrandAzyk.deleteMany({organization: _id[i]})
                await Integrate1CAzyk.deleteMany({organization: _id[i]})
                await AgentRouteAzyk.deleteMany({organization: _id[i]})
                await DistrictAzyk.deleteMany({organization: _id[i]})
                await DistributerAzyk.deleteMany({distributer: _id[i]})
                let distributers = await DistributerAzyk.find({
                    $or: [
                        {sales: _id[i]},
                        {provider: _id[i]}
                    ]
                })
                for(let i=0; i<distributers.length; i++){
                        distributers[i].sales.splice(_id[i], 1)
                        distributers[i].provider.splice(_id[i], 1)
                    await distributers[i].save()
                }
                await AutoAzyk.deleteMany({organization: _id[i]})
                await RepairEquipmentAzyk.deleteMany({organization: _id[i]})
                await OrganizationAzyk.updateOne({_id: _id[i]}, {del: 'deleted', status: 'deactive'})
                await AdsAzyk.updateMany({organization: _id[i]}, {del: 'deleted'})
                await PlanAzyk.deleteMany({organization: _id[i]})
                await DeliveryDateAzyk.deleteMany({organization: _id[i]})
            }
        }
        return {data: 'OK'}
    },
    onoffOrganization: async(parent, { _id }, {user}) => {
        if(user.role==='admin'){
            let objects = await OrganizationAzyk.find({_id: {$in: _id}})
            for(let i=0; i<objects.length; i++){
                objects[i].status = objects[i].status==='active'?'deactive':'active'
                await SubBrandAzyk.updateMany({organization: objects[i]._id}, {status: objects[i].status})
                await EmploymentAzyk.updateMany({organization: objects[i]._id}, {status: objects[i].status})
                let items = await ItemAzyk.find({organization: objects[i]._id}).distinct('_id').lean()
                await BasketAzyk.deleteMany({item: {$in: items}})
                await ItemAzyk.updateMany({organization: objects[i]._id}, {status: objects[i].status})
                await objects[i].save()
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