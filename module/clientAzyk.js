const ClientAzyk = require('../models/clientAzyk');
const InvoiceAzyk = require('../models/invoiceAzyk');

module.exports.reductionToClient = async() => {
    let clients = await ClientAzyk.find({
            $or: [
                {address: {$elemMatch: {$elemMatch: {$eq: ''}}}},
                {'phone.0': ''}
            ],
            del: {$ne: 'deleted'},
        }
    ).select('_id address phone').lean()
    let count = 0
    for(let i = 0; i<clients.length;i++) {
        const invoice = await InvoiceAzyk
            .findOne({
                client: clients[i]._id,
                'address.1': {$ne: ''}
            })
            .sort('-createdAt')
            .select('address')
            .lean()
        if(invoice) {
            count += 1
            const address = clients[i].address
            if(!address[0][0])
                address[0][0] = invoice.address[0]
            if(!address[0][1])
                address[0][1] = invoice.address[1]
            if(!address[0][2])
                address[0][2] = invoice.address[2]
            await ClientAzyk.updateOne({_id: clients[i]._id}, {
                address,
                ...!clients[i].phone[0].length? {phone: ['+996123456789']}: {}
            })
        }
    }
    console.log(`reductionToClient: ${count}`)
}