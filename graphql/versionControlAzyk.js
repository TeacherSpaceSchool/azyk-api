const {sendWebPush} = require('../module/webPush');

const mutation = `
    forceUpdate: String
`;

const resolversMutation = {
    forceUpdate: async(parent, args, {user}) => {
        if(user.role==='admin') {
            await sendWebPush({title: 'AZYK.STORE', message: 'Обновление системы', type: 'forceUpdate'})
            return 'OK'
        }
   }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;