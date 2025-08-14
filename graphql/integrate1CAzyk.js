const Integrate1CAzyk = require('../models/integrate1CAzyk');
const EmploymentAzyk = require('../models/employmentAzyk');
const ClientAzyk = require('../models/clientAzyk');
const ItemAzyk = require('../models/itemAzyk');
const mongoose = require('mongoose');
const {saveFile, deleteFile, reductionSearch, isNotEmpty, defaultLimit} = require('../module/const');
const readXlsxFile = require('read-excel-file/node');
const path = require('path');
const app = require('../app');
const {parallelBulkWrite} = require('../module/parallel');
const OrganizationAzyk = require('../models/organizationAzyk');

const type = `
  type Integrate1C {
      _id: ID
      createdAt: Date
      guid: String
      organization: Organization
      ecspeditor: Employment
      client: Client
      agent: Employment
      item: Item
 }
`;

const query = `
    integrate1Cs(organization: ID!, search: String!, filter: String!, skip: Int): [Integrate1C]
    integrate1CsSimpleStatistic(organization: ID!, search: String!, filter: String!): [String]
    ecspeditorsIntegrate1C(search: String!, organization: ID!): [Employment]
    agentsIntegrate1C(search: String!, organization: ID!): [Employment]
    itemsIntegrate1C(search: String!, organization: ID!): [Item]
    clientsIntegrate1C(search: String!, organization: ID!): [Client]
`;

const mutation = `
    addIntegrate1C(organization: ID!, item: ID, client: ID, guid: String, agent: ID, ecspeditor: ID): Integrate1C
    setIntegrate1C(_id: ID!, guid: String): String
    deleteIntegrate1C(_id: ID!): String
    unloadingIntegrate1C(document: Upload!, organization: ID!): String
`;

const resolvers = {
    integrate1CsSimpleStatistic: async(parent, {search, filter, organization}, {user}) => {
        if(user.role==='admin') {
            organization = organization==='super'?null:organization
            // eslint-disable-next-line no-undef
            const [searchedItems, searchedClients, searchedEmployments] = await Promise.all([
                search?ItemAzyk.find({
                    name: {$regex: reductionSearch(search), $options: 'i'},
                    del: {$ne: 'deleted'}, organization
               }).distinct('_id'):null,
                search?ClientAzyk.find({
                    $or: [
                        {name: {$regex: reductionSearch(search), $options: 'i'}},
                        {address: {$elemMatch: {$elemMatch: {$regex: reductionSearch(search), $options: 'i'}}}}
                    ],
                    del: {$ne: 'deleted'}
               }).distinct('_id'):null,
                search?EmploymentAzyk.find({
                    name: {$regex: reductionSearch(search), $options: 'i'},
                    del: {$ne: 'deleted'}, organization
               }).distinct('_id'):null
            ])
            // eslint-disable-next-line no-undef
            const res = await Promise.all([
                Integrate1CAzyk.countDocuments({
                    organization,
                    ...(
                        filter==='агент'?
                            {agent: {$ne: null}}
                            :
                            filter==='экспедитор'?
                                {ecspeditor: {$ne: null}}
                                :
                                filter==='товар'?
                                    {item: {$ne: null}}
                                    :
                                    filter==='клиент'?
                                        {client: {$ne: null}}
                                        :
                                        {}
                    ),
                    ...search?{$or: [
                            ...!filter||filter==='агент'?[{agent: {$in: searchedEmployments}}]:[],
                            ...!filter||filter==='клиент'?[{client: {$in: searchedClients}}]:[],
                            ...!filter||filter==='экспедитор'?[{ecspeditor: {$in: searchedEmployments}}]:[],
                            ...!filter||filter==='товар'?[{item: {$in: searchedItems}}]:[],
                            {guid: {$regex: reductionSearch(search), $options: 'i'}}
                        ]}:{}
               }),
                !filter||filter==='агент'?(async () => {
                    let agents =  await Integrate1CAzyk.find({organization, agent: {$ne: null}}).distinct('agent')
                    agents = await EmploymentAzyk.find({
                        name: {$regex: reductionSearch(search), $options: 'i'}, organization, _id: {$nin: agents}, del: {$ne: 'deleted'}
                   }).populate({path: 'user', match: {role: organization?'агент':'суперагент', status: 'active'}}).select('user').lean()
                    agents = agents.filter(agent => (agent.user))
                    return agents.length
               })():null,
                !filter||filter==='экспедитор'?(async () => {
                    let ecspeditors =  await Integrate1CAzyk.find({organization, ecspeditor: {$ne: null}}).distinct('ecspeditor')
                    ecspeditors = await EmploymentAzyk.find({
                        name: {$regex: reductionSearch(search), $options: 'i'}, organization, _id: {$nin: ecspeditors}, del: {$ne: 'deleted'}
                   })
                        .populate({path: 'user', match: {role: organization?'экспедитор':'суперэкспедитор', status: 'active'}}).lean()
                    ecspeditors = ecspeditors.filter(ecspeditor => (ecspeditor.user))
                    return ecspeditors.length
               })():null,
                !filter||filter==='товар'?(async () => {
                    let items =  await Integrate1CAzyk.find({organization, item: {$ne: null}}).distinct('item')
                    return ItemAzyk.countDocuments({
                        name: {$regex: reductionSearch(search), $options: 'i'}, _id: {$nin: items}, organization, del: {$ne: 'deleted'}
                   })
               })():null,
                !filter||filter==='клиент'?(async () => {
                    let clients =  await Integrate1CAzyk.find({organization, client: {$ne: null}}).distinct('client')
                    return ClientAzyk.countDocuments({
                        _id: {$nin: clients}, del: {$ne: 'deleted'},
                        $or: [
                            {name: {$regex: reductionSearch(search), $options: 'i'}},
                            {info: {$regex: reductionSearch(search), $options: 'i'}},
                            {address: {$elemMatch: {$elemMatch: {$regex: reductionSearch(search), $options: 'i'}}}}
                        ]
                   }).populate({path: 'user', match: {status: 'active'}}).lean()
               })():null,
            ])
            return res
       }
   },
    integrate1Cs: async(parent, {search, filter, organization, skip}, {user}) => {
        if(user.role==='admin') {
            organization = organization==='super'?null:organization
            // eslint-disable-next-line no-undef
            const [searchedItems, searchedClients, searchedEmployments] = await Promise.all([
                search?ItemAzyk.find({
                    name: {$regex: reductionSearch(search), $options: 'i'},
                    del: {$ne: 'deleted'}, organization
               }).distinct('_id'):null,
                search?ClientAzyk.find({
                    $or: [
                        {name: {$regex: reductionSearch(search), $options: 'i'}},
                        {address: {$elemMatch: {$elemMatch: {$regex: reductionSearch(search), $options: 'i'}}}}
                    ],
                    del: {$ne: 'deleted'}
               }).distinct('_id'):null,
                search?EmploymentAzyk.find({
                    name: {$regex: reductionSearch(search), $options: 'i'},
                    del: {$ne: 'deleted'}, organization
               }).distinct('_id'):null
            ])
            const integrate1Cs = await Integrate1CAzyk.find({
                organization,
                ...filter==='агент'?
                        {agent: {$ne: null}}
                        :
                        filter==='экспедитор'?
                            {ecspeditor: {$ne: null}}
                            :
                            filter==='товар'?
                                {item: {$ne: null}}
                                :
                                filter==='клиент'?
                                    {client: {$ne: null}}
                                    :
                                    {}
                ,
                ...search?{$or: [
                        ...!filter||filter==='агент'?[{agent: {$in: searchedEmployments}}]:[],
                        ...!filter||filter==='клиент'?[{client: {$in: searchedClients}}]:[],
                        ...!filter||filter==='экспедитор'?[{ecspeditor: {$in: searchedEmployments}}]:[],
                        ...!filter||filter==='товар'?[{item: {$in: searchedItems}}]:[],
                        {guid: {$regex: reductionSearch(search), $options: 'i'}}
                    ]}:{}
           })
                .populate({
                    path: 'agent',
                    select: '_id name'
               })
                .populate({
                    path: 'client',
                    select: '_id address name'
               })
                .populate({
                    path: 'ecspeditor',
                    select: '_id name'
               })
                .populate({
                    path: 'item',
                    select: '_id name'
               })
                .sort('-createdAt')
                .skip(isNotEmpty(skip)?skip:0)
                .limit(isNotEmpty(skip)?defaultLimit:10000000000)
                .lean()
            for(let i=0; i<integrate1Cs.length; i++) {
                if(integrate1Cs[i].client) {
                    for(let i1=0; i1<integrate1Cs[i].client.address.length; i1++) {
                        integrate1Cs[i].client.name += ` | ${integrate1Cs[i].client.address[i1][2] ? `${integrate1Cs[i].client.address[i1][2]}, ` : ''}${integrate1Cs[i].client.address[i1][0]}`
                   }
               }
           }
            return integrate1Cs
       }
   },
    ecspeditorsIntegrate1C: async(parent, {search, organization}, {user}) => {
        if(user.role==='admin') {
            organization = organization==='super'?null:organization
            let ecspeditors =  await Integrate1CAzyk.find({organization, ecspeditor: {$ne: null}}).distinct('ecspeditor')
            ecspeditors = await EmploymentAzyk.find({
                name: {$regex: reductionSearch(search), $options: 'i'}, organization, _id: {$nin: ecspeditors}, del: {$ne: 'deleted'}
           })
                .populate({path: 'user', match: {role: organization?'экспедитор':'суперэкспедитор', status: 'active'}}).lean()
            ecspeditors = ecspeditors.filter(ecspeditor => (ecspeditor.user))
            return ecspeditors
       }
        else return []
   },
    agentsIntegrate1C: async(parent, {search, organization}, {user}) => {
        if(user.role==='admin') {
            organization = organization==='super'?null:organization
            let agents =  await Integrate1CAzyk.find({organization, agent: {$ne: null}}).distinct('agent')
            agents = await EmploymentAzyk.find({
                name: {$regex: reductionSearch(search), $options: 'i'}, organization, _id: {$nin: agents}, del: {$ne: 'deleted'}
           }).populate({path: 'user', match: {role: organization?'агент':'суперагент', status: 'active'}}).lean()
            agents = agents.filter(agent => (agent.user))
            return agents
       }
        else return []
   },
    clientsIntegrate1C: async(parent, {search, organization}, {user}) => {
        if(user.role==='admin') {
            organization = await OrganizationAzyk.findById(organization).select('_id cities').lean()
            let clients =  await Integrate1CAzyk.find({organization: organization._id, client: {$ne: null}}).distinct('client')
            clients = await ClientAzyk.find({
                _id: {$nin: clients}, city: organization.cities[0], del: {$ne: 'deleted'},
                $or: [
                    {name: {$regex: reductionSearch(search), $options: 'i'}},
                    {info: {$regex: reductionSearch(search), $options: 'i'}},
                    {address: {$elemMatch: {$elemMatch: {$regex: reductionSearch(search), $options: 'i'}}}}
                ]
           }).populate({path: 'user', match: {status: 'active'}}).lean()
            for(let i=0; i<clients.length; i++) {
                for(let i1=0; i1<clients[i].address.length; i1++) {
                    clients[i].name+=` | ${clients[i].address[i1][2]?`${clients[i].address[i1][2]}, `:''}${clients[i].address[i1][0]}`
               }
           }
            return clients
       }
        else return []
   },
    itemsIntegrate1C: async(parent, {search, organization}, {user}) => {
        if(mongoose.Types.ObjectId.isValid(organization)&&user.role==='admin') {
            let items =  await Integrate1CAzyk.find({organization, item: {$ne: null}}).distinct('item')
            items = await ItemAzyk.find({
                name: {$regex: reductionSearch(search), $options: 'i'}, _id: {$nin: items}, organization, del: {$ne: 'deleted'}
           }).lean()
            return items
       }
        else return []
   }
};

const resolversMutation = {
    addIntegrate1C: async(parent, {organization, item, client, guid, agent, ecspeditor}, {user}) => {
        if(['admin'].includes(user.role)) {
            // eslint-disable-next-line no-undef
            const [createdObject, agentData, ecspeditorData, itemData, clientData] = await Promise.all([
                Integrate1CAzyk.create({...(organization==='super'?{organization: null}:{organization}), guid, item, client, agent, ecspeditor}),
                agent?EmploymentAzyk.findById(agent).select('_id name').lean():null,
                ecspeditor?EmploymentAzyk.findById(ecspeditor).select('_id name').lean():null,
                item?ItemAzyk.findById(item).select('_id name').lean():null,
                client?ClientAzyk.findById(client).select('_id name address').lean():null
            ]);
            return {...createdObject.toObject(), agent: agentData, ecspeditor: ecspeditorData, item: itemData, client: clientData}
       }
        return null;
   },
    setIntegrate1C: async(parent, {_id, guid}, {user}) => {
        if(user.role==='admin') {
            await Integrate1CAzyk.updateOne({_id}, {guid})
       }
        return 'OK'
   },
    deleteIntegrate1C: async(parent, {_id}, {user}) => {
        if(user.role==='admin')
            await Integrate1CAzyk.deleteOne({_id})
        return 'OK'
   },
    unloadingIntegrate1C: async(parent, {document, organization}, {user}) => {
        if(user.role==='admin') {
            let {stream, filename} = await document;
            let xlsxpath = path.join(app.dirname, 'public', await saveFile(stream, filename));
            let rows = await readXlsxFile(xlsxpath)
            //realClientsIdSet
            let filteredRows = rows.filter((row) => mongoose.Types.ObjectId.isValid(row[0])&&row[1])
            let realClientIds = await ClientAzyk.find({_id: {$in: filteredRows.map((row) => row[0])}}).distinct('_id')
            realClientIds = realClientIds.map(realClientId => realClientId.toString())
            filteredRows = filteredRows.filter((row) => realClientIds.includes(row[0]))
            //интеграции
            const integrates = await Integrate1CAzyk.find({
                ...(organization==='super'?{organization: null}:{organization}),
                client: {$in: realClientIds}
           }).select('_id client').lean()
            //integrateByClient
            const integrateByClient = {}
            for(const integrate of integrates) {
                integrateByClient[integrate.client.toString()] = integrate._id
           }
            // подготовим массив операций
            const bulkOperations = [];
            // eslint-disable-next-line no-undef
            for(const row of filteredRows) {
                    let integrateId = integrateByClient[row[0]]
                    if(integrateId)
                        bulkOperations.push({updateOne: {filter: {_id: integrateId}, update: {$set: {guid: row[1]}}}});
                    else
                        bulkOperations.push({insertOne: {document: {
                            client: row[0], ...(organization==='super'?{organization: null}:{organization}), guid: row[1],
                       }}});
           }
            if (bulkOperations.length) await parallelBulkWrite(Integrate1CAzyk, bulkOperations);
            await deleteFile(filename)
            return 'OK'
       }
   }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;