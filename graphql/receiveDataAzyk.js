const ReceivedDataAzyk = require('../models/receivedDataAzyk');
const DistrictAzyk = require('../models/districtAzyk');
const Integrate1CAzyk = require('../models/integrate1CAzyk');
const ClientAzyk = require('../models/clientAzyk');
const AgentRouteAzyk = require('../models/agentRouteAzyk');
const UserAzyk = require('../models/userAzyk');
const OrganizationAzyk = require('../models/organizationAzyk');
const randomstring = require('randomstring');
const {reductionSearch} = require('../module/const');

const type = `
  type ReceivedData {
    _id: ID
    createdAt: Date
    organization: Organization
    guid: String
    name: String
    addres: String
    agent: String
    phone: String
    type: String
    status: String
    position: String
  }
`;

const query = `
    receivedDatas(search: String!, filter: String!, organization: ID!): [ReceivedData]
    filterReceivedData: [Filter]
`;

const mutation = `
    clearAllReceivedDatas(organization: ID!): Data
    deleteReceivedData(_ids: [ID]!): Data
    addReceivedDataClient(_id: ID!): Data
`;

const resolvers = {
    receivedDatas: async(parent, {search, filter, organization}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'admin'].includes(user.role)) {
            return await ReceivedDataAzyk.find({
                organization: user.organization?user.organization:organization,
                type: {'$regex': filter, '$options': 'i'},
                ...search.length ? {
                    $or: [
                        {name: {'$regex': reductionSearch(search), '$options': 'i'}},
                        {addres: {'$regex': reductionSearch(search), '$options': 'i'}}
                    ]
                } : {},
            })
                .sort('-createdAt')
                .lean()
        }
    },
    filterReceivedData: async() => {
        let filter = [
            {
                name: 'Все',
                value: ''
            },
            {
                name: 'Сотрудники',
                value: 'сотрудник'
            },
            {
                name: 'Клиенты',
                value: 'клиент'
            }
        ]
        return filter
    },
};

const resolversMutation = {
    clearAllReceivedDatas: async(parent, {organization}, {user}) => {
        if('admin'===user.role){
            await ReceivedDataAzyk.deleteMany({organization: organization})
        }
        return {data: 'OK'}
    },
    deleteReceivedData: async(parent, { _ids }, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'admin'].includes(user.role)) {
            await ReceivedDataAzyk.deleteMany({_id: {$in: _ids}})
        }
        return {data: 'OK'}
    },
    addReceivedDataClient: async(parent, { _id }, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'admin'].includes(user.role)) {
            let receivedData = await ReceivedDataAzyk.findOne({_id: _id}).lean()
            let integrate1CAzyk = await Integrate1CAzyk.findOne({
                organization: receivedData.organization,
                guid: receivedData.guid
            }).select('_id client').lean()
            if(!integrate1CAzyk){
                let district = await DistrictAzyk.findOne({
                    agent: receivedData.agent
                })
                if(district) {
                    let organization = await OrganizationAzyk.findOne({_id: receivedData.organization}).select('_id cities').lean()
                    let _client = new UserAzyk({
                        login: randomstring.generate(20),
                        role: 'client',
                        status: 'active',
                        password: '12345678',
                    });
                    _client = await UserAzyk.create(_client);
                    _client = new ClientAzyk({
                        name: receivedData.name ? receivedData.name : 'Новый',
                        phone: [receivedData.phone],
                        city: organization.cities[0],
                        address: [[receivedData.addres ? receivedData.addres : '', '', receivedData.name ? receivedData.name : '']],
                        user: _client._id,
                        notification: false
                    });
                    _client = await ClientAzyk.create(_client);
                    let _object = new Integrate1CAzyk({
                        item: null,
                        client: _client._id,
                        agent: null,
                        ecspeditor: null,
                        organization: receivedData.organization,
                        guid: receivedData.guid,
                    });
                    await Integrate1CAzyk.create(_object)
                    district.client.push(_client._id)
                    district.markModified('client');
                    await district.save()
                    await ReceivedDataAzyk.deleteMany({_id: _id})
                }
                else return
            }
            else {
                let _client = await ClientAzyk.findOne({_id: integrate1CAzyk.client});
                if(receivedData.name)
                    _client.name = receivedData.name
                if(receivedData.phone) {
                    _client.phone = [receivedData.phone]
                    _client.markModified('phone');
                }
                if(receivedData.addres||receivedData.name) {
                    _client.address = [[
                        receivedData.addres ? receivedData.addres : _client.address[0][0],
                        _client.address[0][1],
                        receivedData.name ? receivedData.name : _client.address[0][2]
                    ]]
                    _client.markModified('address');
                }
                await _client.save()

                let newDistrict = await DistrictAzyk.findOne({
                    agent: receivedData.agent
                })
                if(newDistrict&&!newDistrict.client.toString().includes(_client._id.toString())){
                    let oldDistrict = await DistrictAzyk.findOne({
                        client: _client._id
                    })
                    if(oldDistrict){
                        let objectAgentRouteAzyk = await AgentRouteAzyk.findOne({district: oldDistrict._id})
                        if(objectAgentRouteAzyk){
                            for(let i=0; i<7; i++) {
                                let index = objectAgentRouteAzyk.clients[i].indexOf(_client._id.toString())
                                if(index!==-1)
                                    objectAgentRouteAzyk.clients[i].splice(index, 1)
                            }
                            objectAgentRouteAzyk.markModified('clients');
                            await objectAgentRouteAzyk.save()
                        }
                        for(let i=0; i<oldDistrict.client.length; i++) {
                            if(oldDistrict.client[i].toString()===_client._id.toString()){
                                oldDistrict.client.splice(i, 1)
                                break
                            }
                        }
                        oldDistrict.markModified('client');
                        await oldDistrict.save()
                    }

                    newDistrict.client.push(_client._id)
                    newDistrict.markModified('client');
                    await newDistrict.save()
                }

                await ReceivedDataAzyk.deleteMany({_id: _id})
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