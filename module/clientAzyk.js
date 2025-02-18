const ClientAzyk = require('../models/clientAzyk');
const UserAzyk = require('../models/userAzyk');
const Integrate1CAzyk = require('../models/integrate1CAzyk');
const AgentRouteAzyk = require('../models/agentRouteAzyk');
const DistrictAzyk = require('../models/districtAzyk');
const InvoiceAzyk = require('../models/invoiceAzyk');
const OrderAzyk = require('../models/orderAzyk');

module.exports.reductionToClient = async() => {
    setTimeout(async () => {
        const oshOrganizationId = '60367caaaea15a0f6def2e19'
        let date = new Date('2025-02-17T03:00:00.000Z')
        const clients = await ClientAzyk.find({city: 'Ош', createdAt: {$lte: date}}).distinct('_id').lean()
        const users = await ClientAzyk.find({_id: {$in: clients}}).distinct('user').lean()
        console.log('ClientAzyk', await ClientAzyk.deleteMany({_id: {$in: clients}}))
        console.log('UserAzyk', await UserAzyk.deleteMany({_id: {$in: users}}))
        console.log('Integrate1CAzyk', await Integrate1CAzyk.deleteMany({organization: oshOrganizationId}))
        console.log('InvoiceAzyk', await InvoiceAzyk.deleteMany({client: {$in: clients}}))
        console.log('OrderAzyk', await OrderAzyk.deleteMany({client: {$in: clients}}))
        console.log('DistrictAzyk', await DistrictAzyk.updateMany({organization: oshOrganizationId}, {client: []}))
        console.log('AgentRouteAzyk', await AgentRouteAzyk.updateMany({organization: oshOrganizationId}, {clients: [[],[],[],[],[],[],[]]}))
    }, 6000)

}