const BasketAzyk = require('../models/basketAzyk');
const {roleList} = require('../module/enum');

const type = `
  type Basket {
    _id: ID
    createdAt: Date
    item: Item
    count: Int
    client: Client
    
    consignment: Int
 }
`;

const query = '';

const mutation = `
    addBasket(item: ID!, count: Int!): String
    deleteBasketAll: String
`;

const resolvers = {
};

const resolversMutation = {
    addBasket: async(parent, {item, count}, {user}) => {
        if(user.client||user.employment) {
            let basket = await BasketAzyk.findOne({item, ...user.client?{client: user.client}:{agent: user.employment}});
            if(!basket) {
                await BasketAzyk.create({item, count, ...user.client?{client: user.client}:{agent: user.employment}})
           } else {
                basket.count = count;
                await basket.save();
           }
       }
        return 'OK';
   },
    deleteBasketAll: async(parent, ctx, {user}) => {
        await BasketAzyk.deleteMany(
            user.client ?
                {client: user.client}
                    :
                {agent: user.employment})
        return 'OK'
   }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;