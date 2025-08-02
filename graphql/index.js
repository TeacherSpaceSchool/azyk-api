const {ApolloServer} = require('apollo-server-express');
const {RedisPubSub} = require('graphql-redis-subscriptions');
const pubsub = new RedisPubSub();
module.exports.pubsub = pubsub;
const {verifydeuserGQL} = require('../module/passport');
const ModelsErrorAzyk = require('../models/errorAzyk');
const {getTypeDefs, getResolvers} = require('./schema');
const {unawaited} = require('../module/const');

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
            if (ctx.connection) {
                return ctx.connection.context;
           }
            else if(ctx&&ctx.req) {
                ctx.res.header('ACCEPT-CH', 'UA-Full-Version, UA-Mobile, UA-Model, UA-Arch, UA-Platform, ECT, Device-Memory, RTT');
                let user = await verifydeuserGQL(ctx.req, ctx.res)
                return {req: ctx.req, res: ctx.res, user: user};
           }
       },
        plugins: [{
            requestDidStart: () => ({
                async didEncounterErrors(ctx) {
                    try {
                        const {request, errors, context} = ctx;
                        const user = context && context.user ? context.user : {};
                        for(const err of errors) {
                            console.error(err)
                            let fieldName = '';
                            if (request&&request.query) {
                                const match = request.query.match(/\{\s*([_A-Za-z][_0-9A-Za-z]*)/);
                                fieldName = match ? match[1] : null;
                           }
                            const path = `path: ${fieldName}${user.role?`, role: ${user.role}`:''}${user.login?`, login: ${user.login}`:''}${user.name?`, name: ${user.name}`:''}`
                            unawaited(() => ModelsErrorAzyk.create({err: `gql: ${err.message}`, path: path.toString()}))
                       }
                   } catch (e) {/**/}
               }
           })
       }]
   })
    server.applyMiddleware({app, path : '/graphql', cors: false})
    return server
}

module.exports.run = run;
