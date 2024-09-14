const {ApolloServer} = require('apollo-server-express');
const {RedisPubSub} = require('graphql-redis-subscriptions');
const pubsub = new RedisPubSub();
module.exports.pubsub = pubsub;
const { verifydeuserGQL } = require('../module/passport');
const ModelsErrorAzyk = require('../models/errorAzyk');
const {getTypeDefs, getResolvers} = require('./schema');

const run = (app)=>{
    const server = new ApolloServer({
        playground: false,
        typeDefs: getTypeDefs(),
        resolvers: getResolvers(),
        subscriptions: {
            keepAlive: 1000,
            onConnect: async (connectionParams) => {
                if (connectionParams&&connectionParams.authorization) {
                    let user = await verifydeuserGQL({headers: {authorization: connectionParams.authorization}}, {})
                    return {
                        user: user,
                    }
                }
                else return {
                    user: {}
                }
                //throw new Error('Missing auth token!');
            },
            onDisconnect: (webSocket, context) => {
                // ...
            },
        },
        context: async (ctx) => {
            //console.log(ctx)
            if (ctx.connection) {
                return ctx.connection.context;
            }
            else if(ctx&&ctx.req) {
                ctx.res.header('ACCEPT-CH', 'UA-Full-Version, UA-Mobile, UA-Model, UA-Arch, UA-Platform, ECT, Device-Memory, RTT');
                let user = await verifydeuserGQL(ctx.req, ctx.res)
                return {req: ctx.req, res: ctx.res, user: user};
            }
        },
        formatError: (err) => {
            console.error(err)

            let _object = new ModelsErrorAzyk({
                err: `gql: ${err.message}`,
                path: JSON.stringify(err.path)
            });
            ModelsErrorAzyk.create(_object)

            return err;
        }
    })
    server.applyMiddleware({ app, path : '/graphql', cors: false })
    return server
    //server.listen().then(({ url }) => {console.log(`🚀  Server ready at ${url}`);});
}

module.exports.run = run;
