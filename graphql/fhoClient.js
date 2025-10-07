const FhoClientAzyk = require('../models/fhoClientAzyk');
const ClientAzyk = require('../models/clientAzyk');
const DistrictAzyk = require('../models/districtAzyk');
const {saveBase64ToFile, urlMain, deleteFile, isNotEmpty, reductionSearchText, defaultLimit, isSameDay} = require('../module/const');
const OrganizationAzyk = require('../models/organizationAzyk');
const SubBrandAzyk = require('../models/subBrandAzyk');
const AgentRouteAzyk = require('../models/agentRouteAzyk');

const type = `
  type FhoClient {
      _id: ID
      createdAt: Date
      organization: Organization
      client: Client
      images: [String]
      history: [FhoClientHistory]
      required: Boolean
 }
  type FhoClientHistory {
       date: Date
       editor: String
 }
`;

const query = `
    fhoClients(organization: ID!, client: ID, district: ID, search: String!, filter: String!, skip: Int): [FhoClient]
    fhoClient(_id: ID!, organization: ID): FhoClient
    clientsForFhoClient(search: String!, organization: ID!, district: ID): [Client]
    requiredFhoClient(client: ID): Boolean
`;

const mutation = `
    addFhoClient(organization: ID!, client: ID!): ID
    setFhoClient(_id: ID!, deletedImages: [Upload]!, uploads: [Upload]!): String
    deleteFhoClient(_id: ID!): String
`;

const resolvers = {
    fhoClients: async(parent, {organization, agent, search, client, filter, skip, district}, {user}) => {
        if(['admin', 'суперорганизация', 'организация', 'менеджер', 'агент', 'мерчендайзер'].includes(user.role)) {
            // eslint-disable-next-line no-undef
            const [districtClients, searchedClients] = await Promise.all([
                ['агент', 'менеджер'].includes(user.role)||district?DistrictAzyk
                    .find(district?{_id: district}:{$or: [{manager: user.employment}, {agent: user.employment}]})
                    .distinct('client'):null,
                search?ClientAzyk.find({$or: [
                    {name: {$regex: reductionSearchText(search), $options: 'i'}},
                    {info: {$regex: reductionSearchText(search), $options: 'i'}},
                    {address: {$elemMatch: {$elemMatch: {$regex: reductionSearchText(search), $options: 'i'}}}}
                ]}).distinct('_id'):null
            ])
            return await FhoClientAzyk.find({
                ...client||searchedClients||districtClients? {
                    $and: [
                        ...client?[{client}]:[],
                        ...districtClients?[{client: {$in: districtClients}}]:[],
                        ...search?[{client: {$in: searchedClients}}]:[]
                    ]
                }:{},
                ...agent?{employment: agent}:{},
                organization: user.organization||(organization==='super'?null:organization),
                ...filter==='пустой'?{images: { $size: 0 }}:{}
           })
                .populate({
                    path: 'client',
                    select: '_id name address'
               })
                .sort('-updatedAt')
                .skip(isNotEmpty(skip) ? skip : 0)
                .limit(isNotEmpty(skip) ? defaultLimit : 10000000000)
                .lean()
       }
   },
    fhoClient: async(parent, {_id, organization}, {user}) => {
        if(['admin', 'client', 'суперорганизация', 'организация', 'менеджер', 'агент', 'мерчендайзер'].includes(user.role)) {
            if(organization) {
                let subBrand = await SubBrandAzyk.findById(organization).select('organization').lean()
                if(subBrand)
                    organization = subBrand.organization
            }
            if(user.organization) organization = user.organization
            const res = await FhoClientAzyk.findOne({
                ...organization?{organization}:{},
                $or: [{_id}, {client: _id}]
            })
                .populate({
                    path: 'client',
                    select: '_id name address'
                })
                .lean()
            if(user.role==='агент'&&res) {
                const today = new Date()
                const dayWeek = (today.getDay() + 6) % 7;
                const districts = await DistrictAzyk.find({agent: user.employment}).distinct('_id')
                const agentRoutes = await AgentRouteAzyk.find({district: {$in: districts}}).select('clients').lean()
                let required = false
                for(const agentRoute of agentRoutes) {
                    required = agentRoute.clients[dayWeek].toString().includes(res.client._id.toString())
                    if(required) break
                }
                res.required = required&&isSameDay(res.updatedAt, today)
            }
            return res
       }
   },
    clientsForFhoClient: async(parent, {search, organization, district}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'агент', 'admin'].includes(user.role)) {
            // eslint-disable-next-line no-undef
            const [districtClients, usedClients, organizationCities] = await Promise.all([
                district||['агент', 'менеджер'].includes(user.role)?DistrictAzyk.find(district?{_id: district}:{$or: [{manager: user.employment}, {agent: user.employment}]}).distinct('client'):null,
                FhoClientAzyk.find({organization: user.organization||organization}).distinct('client'),
                OrganizationAzyk.findById(organization).select('cities').lean()
            ])

            return await ClientAzyk.find({
                $and: [
                    {_id: {$nin: usedClients}},
                    {del: {$ne: 'deleted'}},
                    {city: {$in: organizationCities.cities}},
                    ...districtClients?[{_id: {$in: districtClients}}]:[],
                    ...search?[{$or: [
                            {name: {$regex: reductionSearchText(search), $options: 'i'}},
                            {info: {$regex: reductionSearchText(search), $options: 'i'}},
                            {address: {$elemMatch: {$elemMatch: {$regex: reductionSearchText(search), $options: 'i'}}}}
                        ]}]:[]
                ]
            })
                .sort('-name')
                .limit(100)
                .lean()
        }
    }
};

const resolversMutation = {
    addFhoClient: async(parent, {organization, client}, {user}) => {
        if(
            ['admin', 'суперорганизация', 'организация', 'менеджер', 'агент', 'мерчендайзер'].includes(user.role)&&
            !(await FhoClientAzyk.findOne({organization: user.organization||organization, client}).select('_id').lean())
        ) {
            const object = await FhoClientAzyk.create({
                organization: user.organization||organization, client, images: [],
                history: []
            })
            return object._id
        }
   },
    setFhoClient: async(parent, {_id, deletedImages, uploads}, {user}) => {
        if(['admin', 'client', 'суперорганизация', 'организация', 'менеджер', 'агент', 'мерчендайзер'].includes(user.role)) {
            let object = await FhoClientAzyk.findOne({
                ...user.organization?{organization: user.organization}:{},
                $or: [{_id}, {client: _id}]
            }).select('images').lean()
            let images = object.images
            if(deletedImages.length)
                images = images.filter(image => !deletedImages.includes(image))
            // eslint-disable-next-line no-undef
            await Promise.all([
                ...deletedImages.length?deletedImages.map(deletedImage => deleteFile(deletedImage)):[],
                ...uploads.map(async upload => {images.push(urlMain + await saveBase64ToFile(upload))})
            ])
            await FhoClientAzyk.updateOne(
                {$or: [{_id}, {client: _id}]},
                {images, history: [{date: new Date(), editor: `${user.role}${user.name?` ${user.name}`:''}`}]}
            )
        }
        return 'OK'
   },
    deleteFhoClient: async(parent, {_id}, {user}) => {
        if(['admin', 'суперорганизация', 'организация'].includes(user.role)) {
            const fhoClientImages = await FhoClientAzyk.findOne({...user.organization?{organization: user.organization}:{}, _id}).select('images').lean()
            // eslint-disable-next-line no-undef
            await Promise.all([
                ...fhoClientImages.images.map(image => deleteFile(image)),
                FhoClientAzyk.deleteOne({_id, ...user.organization?{organization: user.organization}:{}})
            ]);
       }
        return 'OK'
   }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;