const ReturnedAzyk = require('../models/returnedAzyk');
const OrganizationAzyk = require('../models/organizationAzyk');
const EmploymentAzyk = require('../models/employmentAzyk');
const DistributerAzyk = require('../models/distributerAzyk');
const DistrictAzyk = require('../models/districtAzyk');
const ClientAzyk = require('../models/clientAzyk');
const randomstring = require('randomstring');
const { setSingleOutXMLReturnedAzykLogic } = require('../module/singleOutXMLAzyk');
const { pubsub } = require('./index');
const { checkFloat, reductionSearch} = require('../module/const');
const RELOAD_RETURNED = 'RELOAD_RETURNED';
const HistoryReturnedAzyk = require('../models/historyReturnedAzyk');
const mongoose = require('mongoose');
const SubBrandAzyk = require('../models/subBrandAzyk');
const uuidv1 = require('uuid/v1.js');

const type = `
  type ReturnedItems {
    _id: ID
    item: String
    count: Int
    allPrice: Float
    allTonnage: Float
    allSize: Float
    weight: Float
    size: Float
    price: Float
  }
  type Returned {
    _id: ID
    inv: Int
    dateDelivery: Date
    createdAt: Date
    updatedAt: Date
    items: [ReturnedItems]
    client: Client
    allPrice: Float 
    info: String,
    address: [String]
    number: String
    confirmationForwarder: Boolean
    sync: Int
    cancelForwarder: Boolean
    allTonnage: Float
    allSize: Float
    editor: String
    sale: Organization
    provider: Organization
    organization: Organization
    agent: Employment 
    del: String
    city: String
    district: String
    track: Int
    forwarder: Employment
  }
  type HistoryReturned {
    createdAt: Date
    returned: ID
    editor: String
  }
  type ReloadReturned {
    who: ID
    client: ID
    agent: ID
    organization: ID
    returned: Returned
    type: String
    manager: ID
  }
  input ReturnedItemsInput {
    _id: ID
    item: String
    count: Int
    allPrice: Float
    allTonnage: Float
    allSize: Float
    name: String
    weight: Float
    size: Float
    price: Float
  }
`;

const query = `
    returnedsFromDistrict(organization: ID!, district: ID!, date: String!): [Returned]
    returneds(search: String!, sort: String!, date: String!, skip: Int, city: String): [Returned]
    returnedsSimpleStatistic(search: String!, date: String, city: String): [String]
    returnedsTrash(search: String!, skip: Int): [Returned]
    returnedsTrashSimpleStatistic(search: String!): [String]
    returnedHistorys(returned: ID!): [HistoryReturned]
    sortReturned: [Sort]
`;

const mutation = `
     setReturnedLogic(track: Int, forwarder: ID, returneds: [ID]!): Data
    addReturned(info: String, unite: Boolean, inv: Boolean, dateDelivery: Date!, address: [[String]], organization: ID!, items: [ReturnedItemsInput], client: ID!): Data
    setReturned(items: [ReturnedItemsInput], returned: ID, confirmationForwarder: Boolean, cancelForwarder: Boolean): Returned
    deleteReturneds(_id: [ID]!): Data
    restoreReturneds(_id: [ID]!): Data
`;

const subscription  = `
    reloadReturned: ReloadReturned
`;

const resolvers = {
    returnedsTrashSimpleStatistic: async(parent, {search}, {user}) => {
        let _organizations;
        let _clients;
        let returneds = [];
        if(search.length>0){
            _organizations = await OrganizationAzyk.find({
                name: {'$regex': reductionSearch(search), '$options': 'i'}
            }).distinct('_id').lean()
            _clients = await ClientAzyk.find({
                $or: [
                    {name: {'$regex': reductionSearch(search), '$options': 'i'}},
                    {address: {$elemMatch: {$elemMatch: {'$regex': reductionSearch(search), '$options': 'i'}}}}
                ]
            }).distinct('_id').lean()
        }
        if(user.role==='admin') {
            returneds =  await ReturnedAzyk.find(
                {
                    del: 'deleted',
                    ...(search.length>0?{
                            $or: [
                                {number: {'$regex': reductionSearch(search), '$options': 'i'}},
                                {info: {'$regex': reductionSearch(search), '$options': 'i'}},
                                {address: {'$regex': reductionSearch(search), '$options': 'i'}},
                                {client: {$in: _clients}},
                                {organization: {$in: _organizations}},
                                {sale: {$in: _organizations}},
                                {provider: {$in: _organizations}},
                            ]
                        }
                        :{})
                }
            )
                .lean()
        }
        return [returneds.length.toString()]
    },
    returnedsTrash: async(parent, {search, skip}, {user}) => {
        let _organizations;
        let _clients;
        if(search.length>0){
            _organizations = await OrganizationAzyk.find({
                name: {'$regex': reductionSearch(search), '$options': 'i'}
            }).distinct('_id').lean()
            _clients = await ClientAzyk.find({
                $or: [
                    {name: {'$regex': reductionSearch(search), '$options': 'i'}},
                    {address: {$elemMatch: {$elemMatch: {'$regex': reductionSearch(search), '$options': 'i'}}}}
                ]
            }).distinct('_id').lean()
        }
        if(user.role==='admin') {
            let returneds =  await ReturnedAzyk.aggregate(
                [
                    {
                        $match:{
                            del: 'deleted',
                            ...(search.length>0?{
                                    $or: [
                                        {number: {'$regex': reductionSearch(search), '$options': 'i'}},
                                        {info: {'$regex': reductionSearch(search), '$options': 'i'}},
                                        {address: {'$regex': reductionSearch(search), '$options': 'i'}},
                                        {client: {$in: _clients}},
                                        {organization: {$in: _organizations}},
                                        {sale: {$in: _organizations}},
                                        {provider: {$in: _organizations}},
                                    ]
                                }
                                :{})
                        }
                    },
                    { $sort : {'createdAt': -1} },
                    { $skip : skip!=undefined?skip:0 },
                    { $limit : skip!=undefined?15:10000000000 },
                    { $lookup:
                        {
                            from: ClientAzyk.collection.collectionName,
                            let: { client: '$client' },
                            pipeline: [
                                { $match: {$expr:{$eq:['$$client', '$_id']}} },
                            ],
                            as: 'client'
                        }
                    },
                    {
                        $unwind:{
                            preserveNullAndEmptyArrays : false,
                            path : '$client'
                        }
                    },
                    { $lookup:
                        {
                            from: OrganizationAzyk.collection.collectionName,
                            let: { sale: '$sale' },
                            pipeline: [
                                { $match: {$expr:{$eq:['$$sale', '$_id']}} },
                            ],
                            as: 'sale'
                        }
                    },
                    {
                        $unwind:{
                            preserveNullAndEmptyArrays : true,
                            path : '$sale'
                        }
                    },
                    { $lookup:
                        {
                            from: OrganizationAzyk.collection.collectionName,
                            let: { provider: '$provider' },
                            pipeline: [
                                { $match: {$expr:{$eq:['$$provider', '$_id']}} },
                            ],
                            as: 'provider'
                        }
                    },
                    {
                        $unwind:{
                            preserveNullAndEmptyArrays : true,
                            path : '$provider'
                        }
                    },
                    { $lookup:
                        {
                            from: EmploymentAzyk.collection.collectionName,
                            let: { agent: '$agent' },
                            pipeline: [
                                { $match: {$expr:{$eq:['$$agent', '$_id']}} },
                            ],
                            as: 'agent'
                        }
                    },
                    {
                        $unwind:{
                            preserveNullAndEmptyArrays : true,
                            path : '$agent'
                        }
                    },
                    { $lookup:
                        {
                            from: EmploymentAzyk.collection.collectionName,
                            let: { forwarder: '$forwarder' },
                            pipeline: [
                                { $match: {$expr:{$eq:['$$forwarder', '$_id']}} },
                            ],
                            as: 'forwarder'
                        }
                    },
                    {
                        $unwind:{
                            preserveNullAndEmptyArrays : true,
                            path : '$forwarder'
                        }
                    },
                    { $lookup:
                        {
                            from: OrganizationAzyk.collection.collectionName,
                            let: { organization: '$organization' },
                            pipeline: [
                                { $match: {$expr:{$eq:['$$organization', '$_id']}} },
                            ],
                            as: 'organization'
                        }
                    },
                    {
                        $unwind:{
                            preserveNullAndEmptyArrays : true,
                            path : '$organization'
                        }
                    },
                ])
            return returneds
        }
    },
    returnedsSimpleStatistic: async(parent, {search, date, city}, {user}) => {
        if(['суперорганизация', 'организация', 'агент', 'менеджер', 'admin', 'суперагент'].includes(user.role)) {
            let clients
            if (['агент', 'менеджер', 'суперагент'].includes(user.role)) {
                clients = await DistrictAzyk
                    .find({$or: [{manager: user.employment}, {agent: user.employment}]})
                    .distinct('client').lean()
            }
            let dateStart;
            let dateEnd;
            if (date !== '') {
                let differenceDates = user.agentHistory
                dateStart = new Date(date)
                dateStart.setHours(3, 0, 0, 0)
                dateEnd = new Date(dateStart)
                dateEnd.setDate(dateEnd.getDate() + 1)
                if (['агент', 'суперагент'].includes(user.role)) {
                    let now = new Date()
                    now.setDate(now.getDate() + 1)
                    now.setHours(3, 0, 0, 0)
                    differenceDates = (now - dateStart) / (1000 * 60 * 60 * 24)
                }
                if(differenceDates>user.agentHistory) {
                    dateStart = new Date()
                    dateStart.setHours(3, 0, 0, 0)
                    dateEnd = new Date(dateStart)
                    dateEnd = new Date(dateEnd.setDate(dateEnd.getDate() - user.agentHistory))
                }
            }
            else {
                dateStart = new Date()
                dateEnd = new Date(dateStart)
                if(dateStart.getHours()>=3)
                    dateEnd.setDate(dateEnd.getDate() + 1)
                else
                    dateStart.setDate(dateEnd.getDate() - 1)
                dateStart.setHours(3, 0, 0, 0)
                dateEnd.setHours(3, 0, 0, 0)
            }
            let _organizations;
            let _clients;
            if (search.length > 0) {
                _organizations = await OrganizationAzyk.find({
                    name: {'$regex': reductionSearch(search), '$options': 'i'}
                }).distinct('_id').lean()
                _clients = await ClientAzyk.find({
                    $or: [
                        {name: {'$regex': reductionSearch(search), '$options': 'i'}},
                        {address: {$elemMatch: {$elemMatch: {'$regex': reductionSearch(search), '$options': 'i'}}}}
                    ]
                }).distinct('_id').lean()
            }
            let returneds = await ReturnedAzyk.find({
                del: {$ne: 'deleted'},
                $and: [{createdAt: {$gte: dateStart}}, {createdAt: {$lt: dateEnd}}],
                confirmationForwarder: true,
                ...city?{city: city}:{},
                ...search.length > 0 ? {
                        $or: [
                            {number: {'$regex': reductionSearch(search), '$options': 'i'}},
                            {info: {'$regex': reductionSearch(search), '$options': 'i'}},
                            {address: {'$regex': reductionSearch(search), '$options': 'i'}},
                            {client: {$in: _clients}},
                            {organization: {$in: _organizations}},
                            {sale: {$in: _organizations}},
                            {provider: {$in: _organizations}}
                        ]
                    }:{},
                ...user.organization ? {
                    $or: [
                        {organization: user.organization},
                        {sale: user.organization},
                        {provider: user.organization},
                    ]
                }:{},
                ...['суперагент', 'агент'].includes(user.role)&&clients.length||'менеджер'===user.role?{client: {$in: clients}}:['суперагент', 'агент'].includes(user.role) ? {agent: user.employment} : {},
            }).lean()
            let tonnage = 0;
            let size = 0;
            let price = 0;
            let lengthList = 0;
            for (let i = 0; i < returneds.length; i++) {
                if (!returneds[i].cancelForwarder) {
                    price += returneds[i].allPrice
                    if (returneds[i].allSize)
                        size += returneds[i].allSize
                    lengthList += 1
                    if (returneds[i].allTonnage)
                        tonnage += returneds[i].allTonnage
                }
            }
            return [lengthList.toString(), checkFloat(price).toString(), checkFloat(tonnage).toString(), checkFloat(size).toString()]
        }
    },
    returnedsFromDistrict: async(parent, {organization, district, date}, {user}) =>  {
        if(['суперорганизация', 'организация', 'агент', 'менеджер', 'admin'].includes(user.role)) {
            let dateStart;
            let dateEnd;
            dateStart = new Date(date)
            dateStart.setHours(3, 0, 0, 0)
            dateEnd = new Date(dateStart)
            dateEnd.setDate(dateEnd.getDate() + 1)
            if (user.role === 'агент') {
                let now = new Date()
                now.setDate(now.getDate() + 1)
                now.setHours(3, 0, 0, 0)
                let differenceDates = (now - dateStart) / (1000 * 60 * 60 * 24)
                if (differenceDates > 3) {
                    dateStart = new Date()
                    dateEnd = new Date(dateStart)
                    dateEnd = new Date(dateEnd.setDate(dateEnd.getDate() - 3))
                }
            }
            let clients
            if (['агент', 'менеджер'].includes(user.role)) {
                clients = await DistrictAzyk
                    .find({$or: [{manager: user.employment}, {agent: user.employment}]})
                    .distinct('client').lean()
            }
            else {
                clients = await DistrictAzyk.findOne({
                    _id: district,
                }).distinct('client').lean();
            }
            return await ReturnedAzyk.aggregate(
                [
                    {
                        $match: {
                            del: {$ne: 'deleted'},
                            $and: [{createdAt: {$gte: dateStart}}, {createdAt: {$lt: dateEnd}}],
                            confirmationForwarder: true,
                            client: {$in: clients},
                            $or: [
                                {organization: user.organization ? user.organization : new mongoose.Types.ObjectId(organization)},
                                {sale: user.organization ? user.organization : new mongoose.Types.ObjectId(organization)},
                                {provider: user.organization ? user.organization : new mongoose.Types.ObjectId(organization)},
                            ]
                        }
                    },
                    {$sort: {createdAt: -1}},
                    {
                        $lookup:
                            {
                                from: ClientAzyk.collection.collectionName,
                                let: {client: '$client'},
                                pipeline: [
                                    {$match: {$expr: {$eq: ['$$client', '$_id']}}},
                                ],
                                as: 'client'
                            }
                    },
                    {
                        $unwind: {
                            preserveNullAndEmptyArrays: false,
                            path: '$client'
                        }
                    },
                    {
                        $lookup:
                            {
                                from: EmploymentAzyk.collection.collectionName,
                                let: {agent: '$agent'},
                                pipeline: [
                                    {$match: {$expr: {$eq: ['$$agent', '$_id']}}},
                                ],
                                as: 'agent'
                            }
                    },
                    {
                        $unwind: {
                            preserveNullAndEmptyArrays: true,
                            path: '$agent'
                        }
                    },
                    {
                        $lookup:
                            {
                                from: EmploymentAzyk.collection.collectionName,
                                let: {forwarder: '$forwarder'},
                                pipeline: [
                                    {$match: {$expr: {$eq: ['$$forwarder', '$_id']}}},
                                ],
                                as: 'forwarder'
                            }
                    },
                    {
                        $unwind: {
                            preserveNullAndEmptyArrays: true,
                            path: '$forwarder'
                        }
                    },
                    {
                        $lookup:
                            {
                                from: OrganizationAzyk.collection.collectionName,
                                let: {sale: '$sale'},
                                pipeline: [
                                    {$match: {$expr: {$eq: ['$$sale', '$_id']}}},
                                ],
                                as: 'sale'
                            }
                    },
                    {
                        $unwind: {
                            preserveNullAndEmptyArrays: true,
                            path: '$sale'
                        }
                    },
                    {
                        $lookup:
                            {
                                from: OrganizationAzyk.collection.collectionName,
                                let: {provider: '$provider'},
                                pipeline: [
                                    {$match: {$expr: {$eq: ['$$provider', '$_id']}}},
                                ],
                                as: 'provider'
                            }
                    },
                    {
                        $unwind: {
                            preserveNullAndEmptyArrays: true,
                            path: '$provider'
                        }
                    },
                    {
                        $lookup:
                            {
                                from: OrganizationAzyk.collection.collectionName,
                                let: {organization: '$organization'},
                                pipeline: [
                                    {$match: {$expr: {$eq: ['$$organization', '$_id']}}},
                                ],
                                as: 'organization'
                            }
                    },
                    {
                        $unwind: {
                            preserveNullAndEmptyArrays: true,
                            path: '$organization'
                        }
                    },
                ])
        }
    },
    returnedHistorys: async(parent, {returned}, {user}) => {
        if(['admin', 'менеджер', 'суперорганизация', 'организация'].includes(user.role)){
            let historyReturneds =  await HistoryReturnedAzyk.find({returned: returned}).lean()
            return historyReturneds
        }
    },
    returneds: async(parent, {search, sort, date, skip, city}, {user}) => {
        if(['admin', 'суперорганизация', 'организация', 'менеджер', 'суперагент', 'агент'].includes(user.role)) {
            let dateStart;
            let dateEnd;
            let clients
            if(date!==''){
                let differenceDates = user.agentHistory
                dateStart = new Date(date)
                dateStart.setHours(3, 0, 0, 0)
                dateEnd = new Date(dateStart)
                dateEnd.setDate(dateEnd.getDate() + 1)
                if(['суперагент', 'агент'].includes(user.role)){
                    let now = new Date()
                    now.setHours(3, 0, 0, 0)
                    now.setDate(now.getDate() + 1)
                    differenceDates = (now - dateStart) / (1000 * 60 * 60 * 24)
                    if(differenceDates>user.agentHistory) {
                        dateStart = new Date()
                        dateStart.setHours(3, 0, 0, 0)
                        dateEnd = new Date(dateStart)
                        dateEnd = new Date(dateEnd.setDate(dateEnd.getDate() - user.agentHistory))
                    }
                }
            }
            else if(['суперагент', 'агент'].includes(user.role)){
                dateEnd = new Date()
                dateEnd.setHours(3, 0, 0, 0)
                dateEnd.setDate(dateEnd.getDate() + 1)
                dateStart = new Date(dateEnd)
                dateStart = new Date(dateStart.setDate(dateStart.getDate() - user.agentHistory))
            }
            if(['суперагент', 'агент', 'менеджер'].includes(user.role)){
                clients = await DistrictAzyk
                    .find({$or: [{manager: user.employment}, {agent: user.employment}]})
                    .distinct('client')
                    .lean()
            }
            let _sort = {}
            _sort[sort[0]==='-'?sort.substring(1):sort]=sort[0]==='-'?-1:1
            let _organizations;
            let _clients;
            if(search.length>0){
                _organizations = await OrganizationAzyk.find({
                    name: {'$regex': reductionSearch(search), '$options': 'i'}
                }).distinct('_id').lean()
                _clients = await ClientAzyk.find({$or: [
                    {name: {'$regex': reductionSearch(search), '$options': 'i'}},
                    {address: {$elemMatch: {$elemMatch: {'$regex': reductionSearch(search), '$options': 'i'}}}}
                ]
                }).distinct('_id').lean()
            }
            let organizations
            if (user.role==='суперагент'){
                organizations = await OrganizationAzyk.find({
                    superagent: true
                })
                    .distinct('_id')
                    .lean()
            }
            return await ReturnedAzyk.aggregate(
                [
                    {
                        $match: {
                            del: {$ne: 'deleted'},
                            ...city ? {city: city} : {},
                            ...(dateStart?{$and: [{createdAt: {$gte: dateStart}}, {createdAt: {$lt: dateEnd}}]}:{}),
                            ...['суперагент', 'агент'].includes(user.role)&&clients.length||'менеджер'===user.role?{client: {$in: clients}}:['суперагент', 'агент'].includes(user.role) ? {agent: user.employment} : {},
                            ...user.role==='суперагент'?{organization: {$in: organizations}}:{},
                            ...(search.length > 0 ? {
                                    $or: [
                                        {number: {'$regex': reductionSearch(search), '$options': 'i'}},
                                        {info: {'$regex': reductionSearch(search), '$options': 'i'}},
                                        {address: {'$regex': reductionSearch(search), '$options': 'i'}},
                                        {client: {$in: _clients}},
                                        {organization: {$in: _organizations}},
                                        {sale: {$in: _organizations}},
                                        {provider: {$in: _organizations}},
                                    ]
                                }
                                : {}),
                            ...user.organization?
                                {
                                    $or: [
                                        {organization: user.organization},
                                        {sale: user.organization},
                                        {provider: user.organization},
                                    ],
                                }:{},
                        }
                    },
                    {$sort: _sort},
                    {$skip: skip != undefined ? skip : 0},
                    {$limit: skip != undefined ? 15 : 10000000000},
                    {
                        $lookup:
                            {
                                from: ClientAzyk.collection.collectionName,
                                let: {client: '$client'},
                                pipeline: [
                                    {$match: {$expr: {$eq: ['$$client', '$_id']}}},
                                ],
                                as: 'client'
                            }
                    },
                    {
                        $unwind: {
                            preserveNullAndEmptyArrays: false,
                            path: '$client'
                        }
                    },
                    {
                        $lookup:
                            {
                                from: EmploymentAzyk.collection.collectionName,
                                let: {agent: '$agent'},
                                pipeline: [
                                    {$match: {$expr: {$eq: ['$$agent', '$_id']}}},
                                ],
                                as: 'agent'
                            }
                    },
                    {
                        $unwind: {
                            preserveNullAndEmptyArrays: true,
                            path: '$agent'
                        }
                    },
                    {
                        $lookup:
                            {
                                from: EmploymentAzyk.collection.collectionName,
                                let: {forwarder: '$forwarder'},
                                pipeline: [
                                    {$match: {$expr: {$eq: ['$$forwarder', '$_id']}}},
                                ],
                                as: 'forwarder'
                            }
                    },
                    {
                        $unwind: {
                            preserveNullAndEmptyArrays: true,
                            path: '$forwarder'
                        }
                    },
                    {
                        $lookup:
                            {
                                from: OrganizationAzyk.collection.collectionName,
                                let: {sale: '$sale'},
                                pipeline: [
                                    {$match: {$expr: {$eq: ['$$sale', '$_id']}}},
                                ],
                                as: 'sale'
                            }
                    },
                    {
                        $unwind: {
                            preserveNullAndEmptyArrays: true,
                            path: '$sale'
                        }
                    },
                    {
                        $lookup:
                            {
                                from: OrganizationAzyk.collection.collectionName,
                                let: {provider: '$provider'},
                                pipeline: [
                                    {$match: {$expr: {$eq: ['$$provider', '$_id']}}},
                                ],
                                as: 'provider'
                            }
                    },
                    {
                        $unwind: {
                            preserveNullAndEmptyArrays: true,
                            path: '$provider'
                        }
                    },
                    {
                        $lookup:
                            {
                                from: OrganizationAzyk.collection.collectionName,
                                let: {organization: '$organization'},
                                pipeline: [
                                    {$match: {$expr: {$eq: ['$$organization', '$_id']}}},
                                ],
                                as: 'organization'
                            }
                    },
                    {
                        $unwind: {
                            preserveNullAndEmptyArrays: true,
                            path: '$organization'
                        }
                    },
                ])

        }
    },
    sortReturned: async() => {
        let sort = [
            {
                name: 'Дата',
                field: 'createdAt'
            },
            {
                name: 'Сумма',
                field: 'allPrice'
            },
            {
                name: 'Кубатура',
                field: 'allTonnage'
            },
            {
                name: 'Тоннаж',
                field: 'allSize'
            }
        ]
        return sort
    },
};

const setReturned = async ({items, returned, confirmationForwarder, cancelForwarder, user}) => {
    let object = await ReturnedAzyk.findOne({_id: returned})
        .populate({
            path: 'client'
        })
        .populate({path: 'organization'})
        .populate({path: 'sale'})
        .populate({path: 'provider'});
    let district = null;
    let distributers = await DistributerAzyk.find({
        sales: object.organization._id
    }).select('distributer').lean()
    if(distributers.length>0){
        for(let i=0; i<distributers.length; i++){
            let findDistrict = await DistrictAzyk.findOne({
                organization: distributers[i].distributer,
                client: object.client._id
            }).select('agent manager').lean()
            if(findDistrict)
                district = findDistrict
        }
    }
    if(!district) {
        let findDistrict = await DistrictAzyk.findOne({
            organization: object.organization._id,
            client: object.client._id
        }).select('agent manager').lean()
        if(findDistrict)
            district = findDistrict
    }
    let editor;
    if(items.length>0&&(['менеджер', 'admin', 'агент', 'суперагент', 'суперорганизация', 'организация'].includes(user.role))){
        let allPrice = 0
        let allTonnage = 0
        let allSize = 0
        for(let i=0; i<items.length;i++){
            allPrice += items[i].allPrice
            allTonnage += items[i].allTonnage
            allSize += items[i].allSize
        }

        object.allPrice = checkFloat(allPrice)
        object.allTonnage = allTonnage
        object.allSize = allSize
        object.items = items
    }
    if(user.role==='admin'){
        editor = 'админ'
    }
    else if(user.role==='client'){
        editor = `клиент ${object.client.name}`
    }
    else{
        let employment = await EmploymentAzyk.findOne({user: user._id}).select('name').lean()
        editor = `${user.role} ${employment.name}`
    }
    object.editor = editor
    if(!object.cancelForwarder&&confirmationForwarder!=undefined){
        object.confirmationForwarder = confirmationForwarder
    }
    if(!object.confirmationForwarder&&cancelForwarder!=undefined){
        if(cancelForwarder){
            object.cancelForwarder = true
        }
        else if(!cancelForwarder) {
            object.cancelForwarder = false
        }
    }
    await object.save();

    if(object.organization.pass&&object.organization.pass.length){
        if(object.confirmationForwarder) {
            const { setSingleOutXMLReturnedAzyk } = require('../module/singleOutXMLAzyk');
            await setSingleOutXMLReturnedAzyk(object)
        }
        else if(object.cancelForwarder) {
            const { cancelSingleOutXMLReturnedAzyk } = require('../module/singleOutXMLAzyk');
            await cancelSingleOutXMLReturnedAzyk(object)
        }
    }

    let objectHistoryReturned = new HistoryReturnedAzyk({
        returned: returned,
        editor: editor,
    });
    await HistoryReturnedAzyk.create(objectHistoryReturned);
    pubsub.publish(RELOAD_RETURNED, { reloadReturned: {
        who: user.role==='admin'?null:user._id,
        client: object.client._id,
        agent: district?district.agent:null,
        organization: object.organization._id,
        returned: object,
        manager: district?district.manager:undefined,
        type: 'SET'
    } });
    return object
}

const resolversMutation = {
    addReturned: async(parent, {info, dateDelivery, unite, address, organization, client, items, inv}, {user}) =>     {
        let subbrand = await SubBrandAzyk.findOne({_id: organization}).select('organization').lean()
        if(subbrand)
            organization = subbrand.organization
        let dateStart = new Date()
        let guid = await uuidv1()
        if(dateStart.getHours()<3)
            dateStart.setDate(dateStart.getDate() - 1)
        dateStart.setHours(3, 0, 0, 0)
        let dateEnd = new Date(dateStart)
        dateEnd.setDate(dateEnd.getDate() + 1)
        let distributers = await DistributerAzyk.find({
            $or: [
                {sales: organization},
                {provider: organization}
            ]
        }).select('distributer sales provider').lean()
        let districtSales = null;
        let districtProvider = null;
        let city = (await ClientAzyk.findById(client).select('city').lean()).city
        if(distributers.length>0){
            for(let i=0; i<distributers.length; i++){
                let findDistrict = await DistrictAzyk.findOne({
                    organization: distributers[i].distributer,
                    client: client
                }).select('agent manager organization').lean()
                if(findDistrict&&distributers[i].sales.toString().includes(organization))
                    districtSales = findDistrict
                if(findDistrict&&distributers[i].provider.toString().includes(organization))
                    districtProvider = findDistrict
            }
        }
        if(!districtSales||!districtProvider) {
            let findDistrict = await DistrictAzyk.findOne({
                organization: organization,
                client: client
            })
                .select('agent manager organization').lean()
            if(!districtSales)
                districtSales = findDistrict
            if(!districtProvider)
                districtProvider = findDistrict
        }
        let objectReturned
        if(unite&&!inv)
            objectReturned = await ReturnedAzyk.findOne({
                organization: organization,
                client: client,
                dateDelivery: dateDelivery,
                $and: [{createdAt: {$gte: dateStart}}, {createdAt: {$lt:dateEnd}}],
                del: {$ne: 'deleted'},
                cancelForwarder: {$ne: true},
                inv: {$ne: 1}
            }).sort('-createdAt').lean()
        let allPrice = 0
        let allTonnage = 0
        let allSize = 0
        if(!objectReturned){
            let number = randomstring.generate({length: 12, charset: 'numeric'});
            while (await ReturnedAzyk.findOne({number: number}).select('_id').lean())
                number = randomstring.generate({length: 12, charset: 'numeric'});
            for(let i = 0; i< items.length; i++){
                allPrice+=items[i].allPrice
                allSize+=items[i].allSize
                allTonnage+=items[i].allTonnage
            }
            objectReturned = new ReturnedAzyk({
                guid,
                items: items,
                client: client,
                allPrice: allPrice,
                allTonnage: allTonnage,
                allSize: allSize,
                dateDelivery: dateDelivery,
                number: number,
                info: info,
                address: address,
                organization: organization,
                district:  districtSales?districtSales.name:null,
                track: 1,
                forwarder: districtProvider?districtProvider.ecspeditor:null,
                sale: districtSales&&districtSales.organization.toString()!==organization.toString()?districtSales.organization:null,
                provider: districtProvider?districtProvider.organization:null,
                city: city
            });
            if(user.employment)
                objectReturned.agent = user.employment
            if(inv)
                objectReturned.inv = 1
            objectReturned = await ReturnedAzyk.create(objectReturned);
        }
        else{
            for(let i = 0; i< items.length; i++){
                let have = false
                for(let i1=0; i1<objectReturned.items.length; i1++) {
                    if(items[i]._id===objectReturned.items[i1]._id){
                        objectReturned.items[i1].count+=items[i].count
                        objectReturned.items[i1].allPrice+=items[i].allPrice
                        objectReturned.items[i1].allTonnage+=items[i].allTonnage
                        objectReturned.items[i1].allSize+=items[i].allSize
                        have = true
                    }
                }
                if(!have)
                    objectReturned.items.push(items[i])
                objectReturned.allPrice+=items[i].allPrice
                objectReturned.allSize+=items[i].allSize
                objectReturned.allTonnage+=items[i].allTonnage
            }
            await ReturnedAzyk.updateOne({_id: objectReturned._id}, {confirmationForwarder: null, items: objectReturned.items, allPrice: objectReturned.allPrice, allSize: objectReturned.allSize, allTonnage: objectReturned.allTonnage})
        }
        if(user.employment&&(await OrganizationAzyk.findOne({_id: organization}).select('autoAcceptAgent').lean()).autoAcceptAgent)
            await setReturned({returned: objectReturned._id, items: [], confirmationForwarder: true, user})
        else
            pubsub.publish(RELOAD_RETURNED, { reloadReturned: {
                who: user.role==='admin'?null:user._id,
                agent: districtSales?districtSales.agent:null,
                client: client,
                organization: organization,
                returned: objectReturned,
                manager: districtSales?districtSales.manager:undefined,
                type: 'ADD'
            } });
        return {data: 'OK'};
    },
    deleteReturneds: async(parent, {_id}, {user}) => {
        if(user.role==='admin'){
            let objects = await ReturnedAzyk.find({_id: {$in: _id}})
            for(let i=0; i<objects.length; i++){
                let findDistrict = await DistrictAzyk.findOne({
                    organization: objects[i].organization,
                    client: objects[i].client
                }).select('agent manager').lean()
                objects[i].del = 'deleted'
                await objects[i].save()
                pubsub.publish(RELOAD_RETURNED, { reloadReturned: {
                    who: user.role==='admin'?null:user._id,
                    client: objects[i].client,
                    agent: findDistrict?findDistrict.agent:null,
                    organization: objects[i].organization,
                    returned: {_id: objects[i]._id},
                    manager: findDistrict?findDistrict.manager:undefined,
                    type: 'DELETE'
                } });
            }
        }
        return {data: 'OK'};
    },
    restoreReturneds: async(parent, {_id}, {user}) => {
        if(user.role==='admin'){
            await ReturnedAzyk.updateMany({_id: {$in: _id}}, {del: null})
        }
        return {data: 'OK'};
    },
    setReturnedLogic: async(parent, {track, forwarder, returneds}) => {
        await setSingleOutXMLReturnedAzykLogic(returneds, forwarder, track)
        return {data: 'OK'};
    },
    setReturned: async(parent, {items, returned, confirmationForwarder, cancelForwarder}, {user}) => {
        return await setReturned({items, returned, confirmationForwarder, cancelForwarder, user})
    }
};

module.exports.RELOAD_RETURNED = RELOAD_RETURNED;
module.exports.subscription = subscription;
module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;