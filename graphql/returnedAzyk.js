const ReturnedAzyk = require('../models/returnedAzyk');
const OrganizationAzyk = require('../models/organizationAzyk');
const EmploymentAzyk = require('../models/employmentAzyk');
const DistrictAzyk = require('../models/districtAzyk');
const ClientAzyk = require('../models/clientAzyk');
const randomstring = require('randomstring');
const {setSingleOutXMLReturnedAzykLogic} = require('../module/singleOutXMLAzyk');
const {checkFloat, reductionSearch, isNotEmpty, checkDate, dayStartDefault} = require('../module/const');
const RELOAD_RETURNED = 'RELOAD_RETURNED';
const HistoryReturnedAzyk = require('../models/historyReturnedAzyk');
const mongoose = require('mongoose');
const SubBrandAzyk = require('../models/subBrandAzyk');
const { v1: uuidv1 } = require('uuid');

const type = `
  type ReturnedItems {
    _id: ID
    item: String
    count: Int
    allPrice: Float
    allTonnage: Float
    weight: Float
    price: Float
    
    size: Float
    allSize: Float
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
    address: [String]
    number: String
    confirmationForwarder: Boolean
    sync: Int
    cancelForwarder: Boolean
    allTonnage: Float
    editor: String
    organization: Organization
    agent: Employment 
    del: String
    city: String
    district: String
    track: Int
    forwarder: Employment
    info: String
    
    provider: Organization
    sale: Organization
    allSize: Float
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
    name: String
    weight: Float
    price: Float
    
    size: Float
    allSize: Float
 }
`;

const query = `
    returnedsFromDistrict(organization: ID!, district: ID!, date: String!): [Returned]
    returneds(search: String!, sort: String!, date: String!, skip: Int, city: String): [Returned]
    returnedsSimpleStatistic(search: String!, date: String, city: String): [String]
    returnedHistorys(returned: ID!): [HistoryReturned]
`;

const mutation = `
    setReturnedLogic(track: Int, forwarder: ID, returneds: [ID]!): String
    addReturned(info: String, unite: Boolean, inv: Boolean, dateDelivery: Date!, address: [[String]], organization: ID!, items: [ReturnedItemsInput], client: ID!): String
    setReturned(items: [ReturnedItemsInput], returned: ID, confirmationForwarder: Boolean, cancelForwarder: Boolean): Returned
    deleteReturneds(_ids: [ID]!): String
`;

const resolvers = {
    returnedsSimpleStatistic: async(parent, {search, date, city}, {user}) => {
        if(['суперорганизация', 'организация', 'агент', 'менеджер', 'admin', 'суперагент'].includes(user.role)) {
            //период
            let dateStart;
            let dateEnd;
            if (date) {
                let differenceDates = user.agentHistory
                dateStart = checkDate(date)
                dateStart.setHours(dayStartDefault, 0, 0, 0)
                dateEnd = new Date(dateStart)
                dateEnd.setDate(dateEnd.getDate() + 1)
                if (['агент', 'суперагент'].includes(user.role)) {
                    let now = new Date()
                    now.setDate(now.getDate() + 1)
                    now.setHours(dayStartDefault, 0, 0, 0)
                    differenceDates = (now - dateStart) / (1000 * 60 * 60 * 24)
               }
                if(differenceDates>user.agentHistory) {
                    dateStart = new Date()
                    dateStart.setHours(dayStartDefault, 0, 0, 0)
                    dateEnd = new Date(dateStart)
                    dateEnd = new Date(dateEnd.setDate(dateEnd.getDate() - user.agentHistory))
               }
           }
            else {
                dateStart = new Date()
                dateEnd = new Date(dateStart)
                if(dateStart.getHours()>=dayStartDefault)
                    dateEnd.setDate(dateEnd.getDate() + 1)
                else
                    dateStart.setDate(dateEnd.getDate() - 1)
                dateStart.setHours(dayStartDefault, 0, 0, 0)
                dateEnd.setHours(dayStartDefault, 0, 0, 0)
           }
            //доступные организации для суперагента, клиенты сотрудника
            // eslint-disable-next-line no-undef
            const [superagentOrganizations, districtClients] = await Promise.all([
                user.role==='суперагент'?OrganizationAzyk.find({superagent: true}).distinct('_id'):null,
                ['агент', 'менеджер', 'суперагент'].includes(user.role)?DistrictAzyk.find({$or: [{manager: user.employment}, {agent: user.employment}]}).distinct('client'):null
            ])
            //возвраты
            let returneds = await ReturnedAzyk.find({
                //не удален
                del: {$ne: 'deleted'},
                //в период
                createdAt: {$gte: dateStart, $lt: dateEnd},
                //принят
                confirmationForwarder: true,
                //суперагент только в доступных организациях
                ...user.role==='суперагент'?{organization: {$in: superagentOrganizations}}:{},
                //город
                ...city?{city}:{},
                //поиск
                ...search ? {
                        $or: [
                            {number: {$regex: reductionSearch(search), $options: 'i'}},
                            {address: {$regex: reductionSearch(search), $options: 'i'}}
                        ]
                   }:{},
                //только в своей организации
                ...user.organization ? {organization: user.organization}:{},
                //только в достпуных клиентах
                ...districtClients?{client: {$in: districtClients}}:{},
           }).lean()
            //подсчет
            let tonnage = 0;
            let price = 0;
            let lengthList = 0;
            for(let i = 0; i < returneds.length; i++) {
                if (!returneds[i].cancelForwarder) {
                    price += returneds[i].allPrice
                    lengthList += 1
                    if (returneds[i].allTonnage)
                        tonnage += returneds[i].allTonnage
               }
           }
            return [lengthList.toString(), checkFloat(price).toString(), checkFloat(tonnage).toString()]
       }
   },
    returnedsFromDistrict: async(parent, {organization, district, date}, {user}) =>  {
        if(['суперорганизация', 'организация', 'агент', 'менеджер', 'admin'].includes(user.role)) {
            //период
            let dateStart;
            let dateEnd;
            dateStart = checkDate(date)
            dateStart.setHours(dayStartDefault, 0, 0, 0)
            dateEnd = new Date(dateStart)
            dateEnd.setDate(dateEnd.getDate() + 1)
            if (user.role === 'агент') {
                let now = new Date()
                now.setDate(now.getDate() + 1)
                now.setHours(dayStartDefault, 0, 0, 0)
                let differenceDates = (now - dateStart) / (1000 * 60 * 60 * 24)
                if (differenceDates > user.agentHistory) {
                    dateStart = new Date()
                    dateEnd = new Date(dateStart)
                    dateEnd = new Date(dateEnd.setDate(dateEnd.getDate() - user.agentHistory))
               }
           }
            //клиенты сотрудника
            let districtClients
            if (['агент', 'менеджер'].includes(user.role))
                districtClients = await DistrictAzyk
                    .find({$or: [{manager: user.employment}, {agent: user.employment}]})
                    .distinct('client')
            else
                districtClients = await DistrictAzyk.findOne({
                    _id: district,
               }).distinct('client');
            return await ReturnedAzyk.aggregate([
                    {
                        $match: {
                            del: {$ne: 'deleted'},
                            createdAt: {$gte: dateStart, $lt: dateEnd},
                            confirmationForwarder: true,
                            client: {$in: districtClients},
                            organization: user.organization ? user.organization : new mongoose.Types.ObjectId(organization)
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
        if(['admin', 'менеджер', 'суперорганизация', 'организация'].includes(user.role)) {
            return HistoryReturnedAzyk.find({returned: returned}).lean()
       }
   },
    returneds: async(parent, {search, sort, date, skip, city}, {user}) => {
        if(['admin', 'суперорганизация', 'организация', 'менеджер', 'суперагент', 'агент'].includes(user.role)) {
            //период
            let dateStart;
            let dateEnd;
            if(date!=='') {
                let differenceDates = user.agentHistory
                dateStart = checkDate(date)
                dateStart.setHours(dayStartDefault, 0, 0, 0)
                dateEnd = new Date(dateStart)
                dateEnd.setDate(dateEnd.getDate() + 1)
                if(['суперагент', 'агент'].includes(user.role)) {
                    let now = new Date()
                    now.setHours(dayStartDefault, 0, 0, 0)
                    now.setDate(now.getDate() + 1)
                    differenceDates = (now - dateStart) / (1000 * 60 * 60 * 24)
                    if(differenceDates>user.agentHistory) {
                        dateStart = new Date()
                        dateStart.setHours(dayStartDefault, 0, 0, 0)
                        dateEnd = new Date(dateStart)
                        dateEnd = new Date(dateEnd.setDate(dateEnd.getDate() - user.agentHistory))
                   }
               }
           }
            else if(['суперагент', 'агент'].includes(user.role)) {
                dateEnd = new Date()
                dateEnd.setHours(dayStartDefault, 0, 0, 0)
                dateEnd.setDate(dateEnd.getDate() + 1)
                dateStart = new Date(dateEnd)
                dateStart = new Date(dateStart.setDate(dateStart.getDate() - user.agentHistory))
           }
            //сортировка
            let _sort = {}
            _sort[sort[0]==='-'?sort.substring(1):sort]=sort[0]==='-'?-1:1
            //доступные организации для суперагента, клиенты сотрудника
            // eslint-disable-next-line no-undef
            const [superagentOrganizations, districtClients] = await Promise.all([
                user.role==='суперагент'?OrganizationAzyk.find({superagent: true}).distinct('_id'):null,
                ['суперагент', 'агент', 'менеджер'].includes(user.role)?DistrictAzyk.find({$or: [{manager: user.employment}, {agent: user.employment}]}).distinct('client').lean():null
            ])
            return await ReturnedAzyk.aggregate([
                {
                    $match: {
                        //не удален
                        del: {$ne: 'deleted'},
                        //в период
                        ...dateStart?{createdAt: {$gte: dateStart, $lt: dateEnd}}:{},
                        //суперагент только в доступных организациях
                        ...user.role==='суперагент'?{organization: {$in: superagentOrganizations}}:{},
                        //город
                        ...city?{city}:{},
                        //поиск
                        ...search?{$or: [
                                {number: {$regex: reductionSearch(search), $options: 'i'}},
                                {info: {$regex: reductionSearch(search), $options: 'i'}},
                                {address: {$regex: reductionSearch(search), $options: 'i'}}
                            ]}:{},
                        //только в своей организации
                        ...user.organization ? {organization: user.organization}:{},
                        //только в районах
                        ...districtClients?{client: {$in: districtClients}}:{}
                    }
                },
                {$sort: _sort},
                {$skip: isNotEmpty(skip) ? skip : 0},
                {$limit: isNotEmpty(skip) ? 15 : 10000000000},
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
   }
};

const setReturned = async ({items, returned, confirmationForwarder, cancelForwarder, user}) => {
    //возврат
    returned = await ReturnedAzyk.findById(returned)
        .populate({
            path: 'client',
            select: '_id name address'
       })
        .populate({
            path: 'agent',
            select: '_id name'
       })
        .populate({
            path: 'organization',
            select: '_id name pass'
       })
        .lean()
    if(items&&items.length) {
        returned.items = items
        //перебор товаров
        returned.allPrice = 0
        returned.allTonnage = 0
        for (let i = 0; i < returned.items.length; i++) {
            returned.allPrice = checkFloat(returned.allPrice + returned.items[i].allPrice)
            returned.allTonnage = checkFloat(returned.allTonnage + returned.items[i].allTonnage)
        }
    }
    //кто изменял
    returned.editor = `${user.role}${user.name?` ${user.name}`:''}`
    //изменеие статуса
    if(!returned.cancelForwarder&&isNotEmpty(confirmationForwarder)) {
        returned.confirmationForwarder = !!confirmationForwarder
   }
    if(!returned.confirmationForwarder&&isNotEmpty(cancelForwarder)) {
        returned.cancelForwarder = !!cancelForwarder
   }
     //интеграция
    if(returned.organization.pass) {
        if(returned.confirmationForwarder) {
            const {setSingleOutXMLReturnedAzyk} = require('../module/singleOutXMLAzyk');
            returned.sync = await setSingleOutXMLReturnedAzyk(returned)
       }
        else if(returned.cancelForwarder) {
            const {cancelSingleOutXMLReturnedAzyk} = require('../module/singleOutXMLAzyk');
            returned.sync = await cancelSingleOutXMLReturnedAzyk(returned)
       }
   }
    //обновление
    await ReturnedAzyk.updateOne({_id: returned._id}, {sync: returned.sync, allPrice: returned.allPrice, allTonnage: returned.allTonnage, items: returned.items, editor: returned.editor, confirmationForwarder: returned.confirmationForwarder, cancelForwarder: returned.cancelForwarder});
    //History edit
    await HistoryReturnedAzyk.create({returned, editor: returned.editor});
    return returned
}

const resolversMutation = {
    addReturned: async(parent, {info, dateDelivery, unite, address, organization, client, items, inv}, {user}) => {
        //фильтруем нулевые значения
        items = items.filter(item => item.count)
        //проверка на подбренд
        let subbrand = await SubBrandAzyk.findById(organization).select('organization').lean()
        if(subbrand)
            organization = subbrand.organization
        //дата доставки
        let dateStart = new Date()
        if(dateStart.getHours()<dayStartDefault)
            dateStart.setDate(dateStart.getDate() - 1)
        dateStart.setHours(dayStartDefault, 0, 0, 0)
        let dateEnd = new Date(dateStart)
        dateEnd.setDate(dateEnd.getDate() + 1)
        //гуид
        let guid = await uuidv1()
        //город по клиенту и район
        // eslint-disable-next-line no-undef
        const [clientCity, district] = await Promise.all([
            ClientAzyk.findById(client).select('city').lean(),
            DistrictAzyk.findOne({organization, client, ...user.role==='агент'?{agent: user._id}:{}}).select('name').lean()
        ])
        let city = clientCity.city
        //проверка на наличие возврата
        let objectReturned
        if(unite&&!inv)
            objectReturned = await ReturnedAzyk.findOne({
                organization,
                client: client,
                dateDelivery,
                createdAt: {$gte: dateStart, $lt: dateEnd},
                del: {$ne: 'deleted'},
                cancelForwarder: {$ne: true},
                inv: {$ne: 1}
           }).sort('-createdAt').lean()
        //общие данные
        let allPrice = 0
        let allTonnage = 0
        //нету
        if(!objectReturned) {
            //номер
            let number = randomstring.generate({length: 12, charset: 'numeric'});
            while (await ReturnedAzyk.findOne({number: number}).select('_id').lean())
                number = randomstring.generate({length: 12, charset: 'numeric'});
            //общий подсчет
            for(let i = 0; i< items.length; i++) {
                allPrice+=items[i].allPrice
                allTonnage+=items[i].allTonnage
           }
            //создание возврата
            objectReturned = await ReturnedAzyk.create({
                guid,
                items,
                client,
                allPrice,
                allTonnage,
                dateDelivery,
                number,
                info,
                address,
                organization,
                district:  district?district.name:null,
                track: 1,
                city,
                agent: user.employment,
                inv: inv?1:null
           });
       }
        else{
            //изменение позиций
            for(let i = 0; i< items.length; i++) {
                //был ли уже товар
                let have = false
                for(let i1=0; i1<objectReturned.items.length; i1++) {
                    if(items[i]._id.toString()===objectReturned.items[i1]._id.toString()) {
                        objectReturned.items[i1].count+=items[i].count
                        objectReturned.items[i1].allPrice+=items[i].allPrice
                        objectReturned.items[i1].allTonnage+=items[i].allTonnage
                        have = true
                   }
               }
                //нет добавялем
                if(!have)
                    objectReturned.items.push(items[i])
                //общий пересчет
                objectReturned.allPrice+=items[i].allPrice
                objectReturned.allTonnage+=items[i].allTonnage
           }
            //добавление возврата
            await ReturnedAzyk.updateOne({_id: objectReturned._id}, {confirmationForwarder: null, items: objectReturned.items, allPrice: objectReturned.allPrice, allTonnage: objectReturned.allTonnage})
       }
        if(user.employment&&(await OrganizationAzyk.findById(organization).select('autoAcceptAgent').lean()).autoAcceptAgent)
            await setReturned({returned: objectReturned._id, items: [], confirmationForwarder: true, user})
        return 'OK';
   },
    deleteReturneds: async(parent, {_ids}, {user}) => {
        if(user.role==='admin') {
            await ReturnedAzyk.updateMany({_id: {$in: _ids}}, {del: 'deleted'})
       }
        return 'OK';
   },
    setReturnedLogic: async(parent, {track, forwarder, returneds}) => {
        await setSingleOutXMLReturnedAzykLogic(returneds, forwarder, track)
        return 'OK';
   },
    setReturned: async(parent, {items, returned, confirmationForwarder, cancelForwarder}, {user}) => {
        return await setReturned({items, returned, confirmationForwarder, cancelForwarder, user})
   }
};

module.exports.RELOAD_RETURNED = RELOAD_RETURNED;
module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;