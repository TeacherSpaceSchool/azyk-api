const ContactAzyk = require('../models/contactAzyk');
const {saveImage, deleteFile, urlMain, saveBase64ToFile} = require('../module/const');

const type = `
  type Contact {
    name: String
    image: String
    address: [String]
    email: [String]
    phone: [String]
    info: String
    warehouse: String
    
    social: [String]
 }
`;

const query = `
    contact: Contact
`;

const mutation = `
    setContact(warehouse: String!, name: String!, image: Upload, address: [String]!, email: [String]!, phone: [String]!, info: String!): String
`;

const resolvers = {
    contact: async() => {
        return await ContactAzyk.findOne().lean()
   }
};

const resolversMutation = {
    setContact: async(parent, {warehouse, name, image, address, email, phone, info}, {user}) => {
        if(user.role==='admin') {
            let object = await ContactAzyk.findOne()
            if (image) {
                // eslint-disable-next-line no-undef
                const [savedFilename] = await Promise.all([
                    saveBase64ToFile(image),
                    deleteFile(object.image)
                ])
                object.image = urlMain + savedFilename
           }
            object.warehouse = warehouse
            object.name = name
            object.info = info
            object.phone = phone
            object.email = email
            object.address = address
            await object.save();
       }
        return 'OK'
   },
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;