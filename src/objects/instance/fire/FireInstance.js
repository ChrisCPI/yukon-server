import BaseInstance from '../BaseInstance'


export default class FireInstance extends BaseInstance {

    constructor(waddle) {
        super(waddle)

        this.id = 997

        this.ninjas = {}

        this.xpPercentageStart = 60

        this.rankSpeed = 1

        this.itemAwards = [4025, 4026, 4027, 4028, 4029, 4030, 4031, 4032, 4033, 104]
        this.postcardAwards = { 1: 177, 5: 178, 9: 179 }

        //this.handleSendDeal = this.handleSendDeal.bind(this)
        //this.handlePickCard = this.handlePickCard.bind(this)
    }

    /*init() {
        super.init()

        for (let user of this.users) {
            //this.ninjas[user.id] = new Ninja(user)
        }

        for (let user of this.users) {
            let opponent = this.getOpponent(user)

            if (opponent) this.ninjas[user.id].opponent = this.ninjas[opponent.id]
        }
    }*/

    addListeners(user) {
        //user.events.on('send_deal', this.handleSendDeal)
        //user.events.on('pick_card', this.handlePickCard)

        super.addListeners(user)
    }

    removeListeners(user) {
        //user.events.off('send_deal', this.handleSendDeal)
        //user.events.off('pick_card', this.handlePickCard)

        super.removeListeners(user)
    }

    start() {
        let users = this.users.map(user => {
            return {
                username: user.username,
                color: user.color
            }
        })

        this.send('start_game', { users: users })

        super.start()
    }

}
