# BlockChan Agent
The BlockChan Agent is a piece of software that operates between the BlockChan Server and a Bitcoin wallet. The agent periodically polls the server for new orders, trying to fill them if possible. A typical order contains two data fields --- a Bitcoin address and a number of bitcoins to be sent. When the agent has fetched an order that has not yet been fetched, it will attempt to fill it by sending the required number of bitcoins to the defined address. In essence, that is all the BlockChan Agent is meant to do.

# Warning!
A security breach on the server side could lead to the theft of all bitcoins accessible by the agent.
