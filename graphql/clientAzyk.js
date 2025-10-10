const ClientAzyk = require('../models/clientAzyk');
const UserAzyk = require('../models/userAzyk');
const BasketAzyk = require('../models/basketAzyk');
const DistrictAzyk = require('../models/districtAzyk');
const AgentRouteAzyk = require('../models/agentRouteAzyk');
const Integrate1CAzyk = require('../models/integrate1CAzyk');
const {
    deleteFile, urlMain, saveImage, reductionSearch, isNotEmpty, checkDate, unawaited, dayStartDefault, defaultLimit, reductionSearchText
} = require('../module/const');
const mongoose = require('mongoose')
const { v1: uuidv1 } = require('uuid');
const randomstring = require('randomstring');
const {addHistory, historyTypes} = require('../module/history');

const type = `
  type Client {
    _id: ID
    image: String
    name: String
    createdAt: Date
    updatedAt: Date
    lastActive: Date
    email: String
    city: String
    address: [[String]]
    phone: [String]
    inn: String
    info: String
    user: Status
    device: String
    category: String
    del: String
    organization: Organization
    notification: Boolean
    network: ClientNetwork
    
    reiting: Int
 }
`;

const query = `
    clientsSimpleStatistic(network: ID, search: String!, filter: String!, date: String, city: String): String
    clients(network: ID, search: String!, sort: String!, filter: String!, date: String, skip: Int, district: ID, city: String, catalog: Boolean): [Client]
    clientsSync(search: String!, organization: ID!, skip: Int!, city: String): [Client]
    clientsSyncStatistic(search: String!, organization: ID!, city: String): String
    client(_id: ID!): Client
`;

const mutation = `
    clearClientsSync(organization: ID!): String
    addClient(network: ID, category: String!, image: Upload, name: String!, email: String, city: String!, address: [[String]]!, phone: [String]!, info: String, inn: String, password: String!, login: String!): ID
    setClient(network: ID, category: String, _id: ID!, device: String, image: Upload, name: String, city: String, phone: [String], login: String, email: String, address: [[String]], inn: String, info: String, newPass: String): String
    deleteClient(_id: ID!): String
    onoffClient(_id: ID!): String
`;

const resolvers = {
    clientsSimpleStatistic: async(parent, {search, date, filter, city, network}, {user}) => {
        if(['менеджер', 'экспедитор', 'агент', 'суперагент', 'admin', 'суперорганизация', 'организация'].includes(user.role)) {
            let dateStart;
            let dateEnd;
            if(date) {
                dateStart = checkDate(date)
                dateStart.setHours(dayStartDefault, 0, 0, 0)
                dateEnd = new Date(dateStart)
                dateEnd.setDate(dateEnd.getDate() + 1)
           }
            let availableClients
            if(['менеджер', 'экспедитор', 'агент', 'суперагент'].includes(user.role)) {
                availableClients = await DistrictAzyk
                    .find({$or: [{manager: user.employment}, {forwarder: user.employment}, {agent: user.employment}]})
                    .distinct('client')
                    .lean()
           }
            const clients = await ClientAzyk
                .aggregate(
                    [
                        {
                            $match:{
                                ...city?{city}:{},
                                ...network?{network: mongoose.Types.ObjectId(network)}:{},
                                ...user.cities?{city: {$in: user.cities}}:{},
                                ...(filter==='Выключенные'?{image: {$ne: null}}:{}),
                                ...(filter==='Без геолокации'?{address: {$elemMatch: {$elemMatch: {$eq: ''}}}}:{}),
                                ...(['A','B','C','D','Horeca'].includes(filter)?{category: filter}:{}),
                                ...date?{createdAt: {$gte: dateStart, $lt: dateEnd}}:{},
                                del: {$ne: 'deleted'},
                                ...availableClients?{_id: {$in: availableClients}}:{},
                                $or: [
                                    {name: {$regex: reductionSearchText(search), $options: 'i'}},
                                    {email: {$regex: reductionSearch(search), $options: 'i'}},
                                    {inn: {$regex: reductionSearch(search), $options: 'i'}},
                                    {info: {$regex: reductionSearchText(search), $options: 'i'}},
                                    {address: {$elemMatch: {$elemMatch: {$regex: reductionSearchText(search), $options: 'i'}}}}
                                ]
                           }
                       },
                        ...(['Без геолокации', 'Выключенные'].includes(filter)?[
                                    {$lookup:
                                        {
                                            from: UserAzyk.collection.collectionName,
                                            let: {user: '$user'},
                                            pipeline: [
                                                {$match: {$expr:{$eq:['$$user', '$_id']}}},
                                            ],
                                            as: 'user'
                                       }
                                   },
                                    {
                                        $unwind:{
                                            preserveNullAndEmptyArrays : true, // this remove the object which is null
                                            path : '$user'
                                       }
                                   },
                                    {
                                        $match:{
                                            'user.status': filter==='Выключенные'?'deactive':'active'
                                       }
                                   }
                                ]
                                :
                                []
                        ),
                        {
                            $count :  'clientCount'
                       }
                    ])
            return clients[0]?clients[0].clientCount:'0'
       }
   },
    clientsSyncStatistic: async(parent, {search, organization, city}, {user}) => {
        if(user.role==='admin') {
            let clients = await ClientAzyk.find({
                sync: organization.toString(),
                ...city?{city}:{},
                $or: [
                    {name: {$regex: reductionSearchText(search), $options: 'i'}},
                    {email: {$regex: reductionSearch(search), $options: 'i'}},
                    {inn: {$regex: reductionSearch(search), $options: 'i'}},
                    {info: {$regex: reductionSearchText(search), $options: 'i'}},
                    {address: {$elemMatch: {$elemMatch: {$regex: reductionSearchText(search), $options: 'i'}}}}
                ]
           })
                .distinct('_id')
                .lean()
            return clients.length.toString()
       }
   },
    clientsSync: async(parent, {search, organization, skip, city}, {user}) => {
        if(user.role==='admin') {
            let clients = await ClientAzyk
                .aggregate(
                    [
                        {
                            $match:{
                                ...city?{city}:{},
                                sync: organization.toString(),
                                $or: [
                                    {name: {$regex: reductionSearchText(search), $options: 'i'}},
                                    {email: {$regex: reductionSearch(search), $options: 'i'}},
                                    {inn: {$regex: reductionSearch(search), $options: 'i'}},
                                    {info: {$regex: reductionSearchText(search), $options: 'i'}},
                                    {address: {$elemMatch: {$elemMatch: {$regex: reductionSearchText(search), $options: 'i'}}}}
                                ]
                           }
                       },
                        {$skip : isNotEmpty(skip)?skip:0},
                        {$limit : isNotEmpty(skip)?15:10000000000},
                        {$lookup:
                            {
                                from: UserAzyk.collection.collectionName,
                                let: {user: '$user'},
                                pipeline: [
                                    {$match: {$expr:{$eq:['$$user', '$_id']}}},
                                ],
                                as: 'user'
                           }
                       },
                        {
                            $unwind:{
                                preserveNullAndEmptyArrays : true, // this remove the object which is null
                                path : '$user'
                           }
                       }
                    ])
            return clients
       }
   },
    clients: async(parent, {network, search, sort, date, skip, filter, city, catalog, district}, {user}) => {
        let dateStart;
        let dateEnd;
        let availableClients
        let _sort = {}
        if(date) {
            dateStart = checkDate(date)
            dateStart.setHours(dayStartDefault, 0, 0, 0)
            dateEnd = new Date(dateStart)
            dateEnd.setDate(dateEnd.getDate() + 1)
       }
        _sort[sort[0]==='-'?sort.substring(1):sort]=sort[0]==='-'?-1:1
        if(['менеджер', 'экспедитор', 'агент', 'суперагент'].includes(user.role)) {
            availableClients = await DistrictAzyk
                .find({$or: [{manager: user.employment}, {forwarder: user.employment}, {agent: user.employment}]})
                .distinct('client')
                .lean()
            if(user.onlyIntegrate) {
                availableClients = await Integrate1CAzyk
                    .find({
                        client: {$in: availableClients},
                        organization: user.organization
                   })
                    .distinct('client')
                    .lean()
           }
       }
        else if(['суперорганизация', 'организация', 'мерчендайзер'].includes(user.role)&&catalog) {
            // eslint-disable-next-line no-undef
            let [districtClients, integrateClients] = await Promise.all([
                user.onlyDistrict?DistrictAzyk.find({organization: user.organization}).distinct('client').lean():null,
                user.onlyIntegrate?Integrate1CAzyk.find({organization: user.organization}).distinct('client').lean():null,
            ]);
            if(districtClients&&integrateClients) {
                districtClients = districtClients.map(id => id.toString())
                integrateClients = integrateClients.map(id => id?id.toString():'')
                availableClients = integrateClients.filter(id => districtClients.includes(id));
                availableClients = availableClients.map(e => mongoose.Types.ObjectId(e))
            }
            else if(districtClients||integrateClients) availableClients = [...districtClients?districtClients:[], ...integrateClients?integrateClients:[]]
        }
        if(district) {
            district = await DistrictAzyk.findById(district).select('client').lean()
            if(availableClients) {
                district = district.clients.toString()
                availableClients = availableClients.filter(availableClient => district.includes(availableClient.toString()))
            }
            else availableClients = district.clients
        }
        if(isNotEmpty(skip)||search.length>2) {
            const res = await ClientAzyk
                .aggregate(
                    [
                        {
                            $match: {
                                ...(['A', 'B', 'C', 'D', 'Horeca'].includes(filter) ? {category: filter} : {}),
                                ...(filter === 'Выключенные' ? {image: {$ne: null}} : {}),
                                ...(filter === 'Без геолокации' ? {address: {$elemMatch: {$elemMatch: {$eq: ''}}}} : {}),
                                ...date?{createdAt: {$gte: dateStart, $lt: dateEnd}}:{},
                                ...city ? {city} : {},
                                ...network?{network: mongoose.Types.ObjectId(network)}:{},
                                ...user.cities?{city: {$in: user.cities}}:{},
                                ...availableClients? {_id: {$in: availableClients}} : {},
                                del: {$ne: 'deleted'},
                                $or: [
                                    {name: {$regex: reductionSearchText(search), $options: 'i'}},
                                    {email: {$regex: reductionSearch(search), $options: 'i'}},
                                    {inn: {$regex: reductionSearch(search), $options: 'i'}},
                                    {info: {$regex: reductionSearchText(search), $options: 'i'}},
                                    {address: {$elemMatch: {$elemMatch: {$regex: reductionSearchText(search), $options: 'i'}}}}
                                ]
                           }
                       },
                        {$sort: _sort},
                        ...(['Без геолокации', 'Включенные', 'Выключенные'].includes(filter) ? [
                                    {
                                        $lookup:
                                            {
                                                from: UserAzyk.collection.collectionName,
                                                let: {user: '$user'},
                                                pipeline: [
                                                    {$match: {$expr: {$eq: ['$$user', '$_id']}}},
                                                ],
                                                as: 'user'
                                           }
                                   },
                                    {
                                        $unwind: {
                                            preserveNullAndEmptyArrays: true, // this remove the object which is null
                                            path: '$user'
                                       }
                                   },
                                    {
                                        $match: {
                                            'user.status': filter === 'Выключенные' ? 'deactive' : 'active'
                                       }
                                   },
                                    {$skip: isNotEmpty(skip) ? skip : 0},
                                    {$limit: isNotEmpty(skip) ? defaultLimit : 10000000000},
                                ]
                                :
                                [
                                    {$skip: isNotEmpty(skip) ? skip : 0},
                                    {$limit: isNotEmpty(skip) ? defaultLimit : 10000000000},
                                    {
                                        $lookup:
                                            {
                                                from: UserAzyk.collection.collectionName,
                                                let: {user: '$user'},
                                                pipeline: [
                                                    {$match: {$expr: {$eq: ['$$user', '$_id']}}},
                                                ],
                                                as: 'user'
                                           }
                                   },
                                    {
                                        $unwind: {
                                            preserveNullAndEmptyArrays: true, // this remove the object which is null
                                            path: '$user'
                                       }
                                   }
                                ]
                        )
                    ]
                )
            return res
       } else return []
   },
    client: async(parent, {_id}, {user}) => {
        if (user.role === 'client')
            _id = user._id
        if(mongoose.Types.ObjectId.isValid(_id)) {
            return await ClientAzyk.findOne({$or: [{_id}, {user: _id}]}).populate({path: 'user'}).lean()
       }
   },
};

const resolversMutation = {
    addClient: async(parent, {image, name, email, city, address, phone, inn, info, login, password, category, network}, {user}) => {
        if(user.role==='admin'||(user.addedClient&&['суперорганизация', 'организация', 'агент'].includes(user.role))) {
            let newUser = await UserAzyk.create({
                login: login.trim(),
                role: 'client',
                status: 'active',
                password,
                category
           });
            if(image) {
                let {stream, filename} = await image;
                image = urlMain + await saveImage(stream, filename)
           }
            const createdObject = await ClientAzyk.create({
                status: 'active',
                user: newUser._id,
                sync: [],
                name,
                email,
                city,
                address,
                phone,
                info,
                inn,
                notification: false,
                image,
                network
           });
            if(user.organization) {
                // eslint-disable-next-line no-undef
                await Promise.all([
                    Integrate1CAzyk.create({client: createdObject._id, organization: user.organization, guid: await uuidv1()}),
                    DistrictAzyk.updateOne({agent: user.employment}, {$push: {client: createdObject._id}})
                ])
           }
            unawaited(() => addHistory({user, type: historyTypes.create, model: 'ClientAzyk', name, object: createdObject._id}))
            return createdObject._id
        }
   },
    setClient: async(parent, {_id, image, name, email, address, info, inn, newPass, phone, login, city, device, category, network}, {user}) => {
        if(
            ['суперорганизация', 'организация', 'агент', 'admin', 'суперагент', 'экспедитор'].includes(user.role)
        ) {
            let object = await ClientAzyk.findById(_id)
            unawaited(() => addHistory({user, type: historyTypes.set, model: 'ClientAzyk', name: object.name, object: _id, data: {image, name, email, address, info, inn, newPass, phone, login, city, device, category}}))
            if (image) {
                let {stream, filename} = await image;
                // eslint-disable-next-line no-undef
                const [savedFilename] = await Promise.all([
                    saveImage(stream, filename),
                    deleteFile(object.image)
                ])
                object.image = urlMain + savedFilename
           }
            if(name) object.name = name
            if(email) object.email = email
            if(address) object.address = address
            if(info) object.info = info
            if(inn) object.inn = inn
            if(city) object.city = city
            if(phone) object.phone = phone
            if(device) object.device = device
            if(category) object.category = category
            if(network) object.network = network
            object.sync = []

            if(newPass||login) {
                let clientUser = await UserAzyk.findById(object.user)
                if(newPass)clientUser.password = newPass
                if(login)clientUser.login = login.trim()
                await clientUser.save()
           }

            await object.save();
       }
        return 'OK'
   },
    deleteClient: async(parent, {_id}, {user}) => {
        if(user.role==='admin') {
            let client = await ClientAzyk.findById(_id).select('name image user').lean()
            // eslint-disable-next-line no-undef
            const [districtIds] = await Promise.all([
                DistrictAzyk.find({client: _id}).distinct('_id'),
                DistrictAzyk.updateMany({client: _id}, {$pull: {client: _id}}),
                client.image?deleteFile(client.image):null,
                client.user?UserAzyk.updateOne({_id: client.user}, {status: 'deactive', login: randomstring.generate({length: 12, charset: 'numeric'})}):null,
                BasketAzyk.deleteMany({client: _id}),
                Integrate1CAzyk.deleteMany({client: _id}),
                ClientAzyk.updateOne({_id}, {del: 'deleted', sync: []})
            ])
            // eslint-disable-next-line no-undef
            await Promise.all(
                Array.from({length: 7}, (_, i) =>
                    AgentRouteAzyk.updateMany({district: {$in: districtIds}, [`clients.${i}`]: _id}, {$pull: {[`clients.${i}`]: _id}})
                )
            )
            unawaited(() => addHistory({user, type: historyTypes.delete, model: 'ClientAzyk', name: client.name, object: _id}))
       }
        return 'OK'
   },
    clearClientsSync: async(parent, {organization}, {user}) => {
        if(user.role==='admin')
            await ClientAzyk.updateMany({sync: organization.toString()}, {$pull: {sync: organization.toString()}});
        return 'OK'
   },
    onoffClient: async(parent, {_id}, {user}) => {
        if(['агент', 'admin', 'суперагент', 'суперорганизация', 'организация'].includes(user.role)) {
            //получаем ссылку на пользователя
            const client = await ClientAzyk.findById(_id).select('name user').lean()
            //находим пользователя
            const clientUser = await UserAzyk.findOne({_id: client.user}).select('_id status').lean()
            //обновляем статус пользователя
            const newStatus = clientUser.status==='active'?'deactive':'active'
            await UserAzyk.updateOne({_id: clientUser._id}, {status: newStatus})
            unawaited(() => addHistory({user, type: historyTypes.set, model: 'ClientAzyk', name: client.name, object: _id, data: {status: newStatus}}))
            return 'OK'
       }
   }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;