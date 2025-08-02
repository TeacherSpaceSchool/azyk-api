const ContactAzyk = require('../models/contactAzyk');

module.exports.reductionContactAzyk = async () => {
    const contact = await ContactAzyk.findOne().lean()
    if(!contact) {
        await ContactAzyk.create({
            name: '',
            image: '',
            address: [],
            email: [],
            phone: [],
            info: ''
       })
   }
}