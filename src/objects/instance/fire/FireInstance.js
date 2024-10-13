import BaseInstance from '../BaseInstance'

import Ninja from './ninja/Ninja'

import { between } from '@utils/math'


const defaultTiles = [0, 8, 4, 12]

export default class FireInstance extends BaseInstance {

    constructor(waddle) {
        super(waddle)

        this.id = 997

        this.ninjas = {}

        this.xpPercentageStart = 60

        this.rankSpeed = 1

        this.board = ['b', 's', 'w', 'f', 'c',
            's', 'f', 'w', 'b', 's',
            'w', 'f', 'c', 'w', 's', 'f']

        this.tileIds = [...defaultTiles]

        this.itemAwards = [6025, 4120, 2013, 1086, 3032]
        this.postcardAwards = { 1: 177, 5: 178, 9: 179 }

        this.currentNinja = null

        this.tabId = null

        //this.handleSendDeal = this.handleSendDeal.bind(this)
        //this.handlePickCard = this.handlePickCard.bind(this)
    }

    init() {
        super.init()

        for (let user of this.users) {
            this.ninjas[user.id] = new Ninja(user, this)
            this.ninjas[user.id].tile = defaultTiles[this.getSeat(user)]
        }

        this.nextRound()
    }

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
            const ninja = this.ninjas[user.id]
            return {
                username: user.username,
                color: user.color,
                energy: ninja.energy,
                tile: ninja.tile
            }
        })

        this.send('start_game', { users: users })

        this.sendNextRound()

        super.start()
    }

    nextRound() {
        const index = this.currentNinja ? this.getSeat(this.currentNinja.user) : 0
        let nextNinja = (index + 1 >= Object.keys(this.ninjas).length) ? 0 : index + 1
        this.currentNinja = Object.values(this.ninjas)[nextNinja]

        this.tabId = null
        this.spinAmount = between(1, 6)

        const ninjaPosition = this.currentNinja.tile
        this.moveClockwise = (ninjaPosition + this.spinAmount) % 16
        this.moveCounterClockwise = (ninjaPosition - this.spinAmount) % 16

        for (let ninja of Object.values(this.ninjas)) {
            ninja.dealCards()
        }
    }

    sendNextRound() {
        for (let user of this.users) {
            user.send('next_round', {
                ninja: this.getSeat(this.currentNinja.user),
                deck: this.ninjas[user.id].dealt,
                spin: {
                    amount: this.spinAmount,
                    cw: this.moveClockwise,
                    ccw: this.moveCounterClockwise
                }
            })
        }
    }

}
