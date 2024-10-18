import BaseInstance from '../BaseInstance'

import Ninja from './ninja/Ninja'

import Rules from '../card/Rules'

import { hasProps, isInRange, isNumber } from '@utils/validation'

import { between } from '@utils/math'


const elements = ['f', 'w', 's']

const defaultTiles = [0, 8, 4, 12]

const autoplayWait = 22000

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

        this.itemAwards = [6025, 4120, 2013, 1086, 3032]

        this.moveTiles = []

        this.currentSeat = 0

        this.tabId = null

        this.battle = {
            state: 0,
            type: 1,
            element: null,
            seats: []
        }

        this.podium = new Array(this.users.length).fill(0)
        this.finishPosition = this.users.length

        this.handleNinjaReady = this.handleNinjaReady.bind(this)
        this.handleSpinnerSelect = this.handleSpinnerSelect.bind(this)
        this.handleBoardSelect = this.handleBoardSelect.bind(this)
        this.handlePickCard = this.handlePickCard.bind(this)
        this.handleChooseElement = this.handleChooseElement.bind(this)
    }

    get allNinjas() {
        return Object.values(this.ninjas)
    }

    init() {
        super.init()

        for (let user of this.users) {
            this.ninjas[user.id] = new Ninja(user)
            this.ninjas[user.id].tile = defaultTiles[this.getSeat(user)]
        }

        this.nextRound()
    }

    getNinja(seat) {
        let user = this.users[seat]

        return this.ninjas[user.id]
    }

    getSeatByNinja(ninja) {
        const n = this.ninjas[ninja.user.id]
        return this.getSeat(n.user)
    }

    get currentNinja() {
        return this.getNinja(this.currentSeat)
    }

    addListeners(user) {
        user.events.on('ninja_ready', this.handleNinjaReady)
        user.events.on('spinner_select', this.handleSpinnerSelect)
        user.events.on('board_select', this.handleBoardSelect)
        user.events.on('pick_card', this.handlePickCard)
        user.events.on('choose_element', this.handleChooseElement)
        user.events.on('choose_opponent', this.handleChooseOpponent)

        super.addListeners(user)
    }

    removeListeners(user) {
        user.events.off('ninja_ready', this.handleNinjaReady)
        user.events.off('spinner_select', this.handleSpinnerSelect)
        user.events.off('board_select', this.handleBoardSelect)
        user.events.off('pick_card', this.handlePickCard)
        user.events.off('choose_element', this.handleChooseElement)
        user.events.off('choose_opponent', this.handleChooseOpponent)

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

    setChooseBoardTimeout() {
        this.chooseBoardTimeout = setTimeout(() => {
            this.autoChooseBoard()
            this.chooseBoardTimeout = null
        }, autoplayWait)
    }

    setChooseCardTimeout() {
        if (this.chooseBoardTimeout) {
            this.clearChooseBoardTimeout()
        }

        this.chooseCardTimeout = setTimeout(() => {
            this.autoChooseCard()
            this.chooseCardTimeout = null
        }, autoplayWait)
    }

    clearChooseBoardTimeout() {
        clearTimeout(this.chooseBoardTimeout)
        this.chooseBoardTimeout = null
    }

    clearChooseCardTimeout() {
        clearTimeout(this.chooseCardTimeout)
        this.chooseCardTimeout = null
    }

    autoChooseBoard() {
        if (!this.currentNinja.hasSelectedSpinner) {
            this.tabId = 1
            this.currentNinja.hasSelectedSpinner = true
            this.send('spinner_select', { tabId: this.tabId })
        }

        const tile = this.moveTiles[between(0, 1)]
        this.selectBoard(tile, true)
    }

    autoChooseCard() {
        for (let seat of this.battle.seats) {
            const ninja = this.getNinja(seat)

            if (!ninja.pick) {
                this.autoPickCard(ninja)
            }
        }
    }

    autoPickCard(ninja) {
        const dealt = ninja.hasPlayableCards(this.battle.element) && this.battle.element !== 'b'
            ? ninja.dealt.filter(card => card.element == this.battle.element)
            : ninja.dealt
    
        const card = dealt[between(0, dealt.length - 1)]
        ninja.send('auto_pick_card', { card: card.id })
        this.pickCard(ninja, card.id)
    }

    handleNinjaReady(args, user) {
        if (this.battle.state !== 0) return

        const ninja = this.ninjas[user.id]

        if (ninja.readyForNext) return

        ninja.readyForNext = true

        if (this.allNinjas.every(n => n.readyForNext === true)) {
            this.nextRound()
            this.sendNextRound()
        }
    }

    handleSpinnerSelect(args, user) {
        if (!hasProps(args, 'tabId')) return

        if (!isNumber(args.tabId)) return

        if (!isInRange(args.tabId, 1, 6)) return

        if (this.getSeat(user) !== this.currentSeat) return

        if (this.currentNinja.hasSelectedSpinner) return

        this.currentNinja.hasSelectedSpinner = true

        this.send('spinner_select', { tabId: args.tabId }, user)
    }

    handleBoardSelect(args, user) {
        if (!hasProps(args, 'spaceId')) return

        if (!isNumber(args.spaceId)) return

        if (this.getSeat(user) !== this.currentSeat) return

        if (!this.currentNinja.hasSelectedSpinner) return

        if (this.battle.state !== 0) return

        const tile = args.spaceId

        if (!this.moveTiles.includes(tile)) return

        this.selectBoard(tile)
    }

    selectBoard(tile, autoPlay = false) {
        const ninja = this.currentNinja

        ninja.tile = tile

        if (autoPlay) {
            ninja.send('auto_board_select', { tile: tile })
        }

        this.send('board_select', { ninja: this.currentSeat, tile: tile })

        this.battle.type = 1

        const element = this.board[tile]

        let tileOccupants = this.getNinjasOnTile(tile)

        if (tileOccupants.length > 1) {
            this.battle.state = 2
            this.battle.element = 'b'
            
            if (autoPlay) {
                tileOccupants = tileOccupants.filter(n => n.user.id !== ninja.user.id)
                const opponent = tileOccupants[between(0, tileOccupants.length - 1)]
                this.chooseOpponent(this.getSeatByNinja(opponent))
            } else if (tileOccupants.length > 2) {
                this.battle.state = 2
                ninja.send('choose_opponent')
            } else {
                const opponent = tileOccupants.find(n => n.user.id !== ninja.user.id)
                this.chooseOpponent(this.getSeatByNinja(opponent))
            }
        } else if (elements.includes(element)) {
            this.startElementalBattle(element)
        } else if (element === 'c') {
            if (autoPlay) {
                const randomElement = elements[between(0, 2)]
                this.startElementalBattle(randomElement)
            } else {
                this.battle.state = 1
                ninja.send('choose_element')
            }
        } else if (element === 'b') {
            this.battle.element = element
            this.battle.state = 2

            const ninjas = this.allNinjas.length

            if (autoPlay || ninjas === 2) {
                const opponent = this.allNinjas.find(n => this.getSeatByNinja(n) !== this.currentSeat)
                this.chooseOpponent(this.getSeatByNinja(opponent))
            } else if (ninjas > 2) {
                this.battle.state = 2
                ninja.send('choose_opponent')
            }
        }
    }

    startElementalBattle(element) {
        this.battle.state = 3
        this.battle.element = element
        this.battle.seats = this.allNinjas.map(n => this.getSeatByNinja(n))

        this.setChooseCardTimeout()

        this.send('start_battle', { type: element, seats: this.battle.seats })
    }

    handleChooseElement(args, user) {
        if (!hasProps(args, 'element')) return

        if (!elements.includes(args.element)) return

        if (this.battle.state !== 1) return

        if (this.getSeat(user) !== this.currentSeat) return

        this.startElementalBattle(args.element)
    }

    handleChooseOpponent(args, user) {
        if (!hasProps(args, 'seat')) return

        if (!isInRange(args.seat, 0, this.users.length - 1)) return

        if (this.battle.state !== 2) return

        if (this.getSeat(user) !== this.currentSeat) return

        this.chooseOpponent(args.seat)
    }

    handlePickCard(args, user) {
        if (!hasProps(args, 'card')) return

        if (!isNumber(args.card)) return

        if (this.battle.state !== 3) return

        if (!this.battle.seats.includes(this.getSeat(user))) return

        const ninja = this.ninjas[user.id]

        if (!ninja.isInDealt(args.card) || ninja.pick) return

        const pick = ninja.getPick(args.card)

        if (this.battle.element !== 'b' && pick.element != this.battle.element) {
            if (ninja.hasPlayableCards(this.battle.element)) {
                return
            }
        }

        this.pickCard(ninja, args.card)
    }

    pickCard(ninja, card) {
        ninja.pickCard(card)

        this.send('opponent_pick_card', { seat: this.getSeatByNinja(ninja) }, ninja.user)

        if (this.battle.seats.every(seat => this.getNinja(seat).pick !== null)) {
            this.judgeBattle()
        }
    }

    chooseOpponent(seat) {
        if (seat !== this.currentSeat) {
            this.battle.type = 2
            this.battle.state = 3

            this.battle.seats = [this.currentSeat, seat]

            this.setChooseCardTimeout()

            this.send('start_battle', { type: this.battle.element, seats: this.battle.seats })
        }
    }

    getNinjasOnTile(tile) {
        return this.allNinjas.filter(ninja => ninja.tile === tile)
    }

    judgeBattle() {
        this.clearChooseCardTimeout()
        this.resolveBattle()

        for (let ninja of this.allNinjas) {
            if (ninja.energy === 0) {
                this.podium[this.getSeatByNinja(ninja)] = this.finishPosition
                this.finishPosition--
            }
        }

        if (this.finishPosition === 1) {
            const winnerSeat = this.podium.indexOf(0)
            this.podium[winnerSeat] = 1
        }

        const data = this.battle.seats.map(seat => {
            const ninja = this.getNinja(seat)
            return {
                seat: seat,
                card: ninja.pick,
                energy: ninja.energy,
                state: ninja.state,
            }
        })

        for (let ninja of this.allNinjas) {
            ninja.readyForNext = false

            if (ninja.energy === 0 || this.finishPosition === 1) {
                const finish = this.podium[this.getSeatByNinja(ninja)]

                // update progress

                ninja.send('finish', { finish: finish })
                this.remove(ninja.user, false)
            }

            ninja.send('judge_battle', {
                ninjas: data,
                battleType: this.battle.element,
                podium: this.podium
            })
        }

        this.battle.state = 0
    }

    resolveBattle() {
        if (this.battle.type === 1) {
            const cardValues = this.battle.seats.map(seat => {
                const ninja = this.getNinja(seat)

                if (ninja.pick.element == this.battle.element) {
                    return ninja.pick.value
                }

                return 0
            })

            const highestValue = Math.max(...cardValues)
            const isTie = cardValues.filter(v => v === highestValue).length >= 2

            for (let seat of this.battle.seats) {
                const ninja = this.getNinja(seat)
                const card = ninja.pick

                if (card.element !== this.battle.element) {
                    ninja.state = 1
                    ninja.energy -= 1
                } else if (isTie && card.value === highestValue) {
                    ninja.state = 2
                } else if (card.value === highestValue) {
                    ninja.state = 3
                } else {
                    ninja.state = 1
                    ninja.energy -= 1
                }
            }
        } else if (this.battle.type === 2) {
            const [seat1, seat2] = this.battle.seats
            const pick1 = this.getNinja(seat1).pick
            const pick2 = this.getNinja(seat2).pick

            const winSeat = this.getWinningSeat(pick1, pick2)

            let winNinja
            let loseNinja

            if (winSeat === -1) {
                winNinja = this.getNinja(0)
                loseNinja = this.getNinja(1)

                winNinja.state = 2
                loseNinja.state = 2
            } else {
                winNinja = this.getNinja(this.battle.seats[winSeat])
                loseNinja = this.getNinja(this.battle.seats[winSeat === 1 ? 0 : 1])

                winNinja.state = 4
                loseNinja.state = 1

                winNinja.energy += 1
                loseNinja.energy -= 1
            }

            this.battle.element = winSeat === 0 ? pick1.element : pick2.element
        }
    }

    getWinningSeat(first, second) {
        if (first.element != second.element) return this.compareElements(first, second)

        if (first.value > second.value) return 0

        if (second.value > first.value) return 1

        return -1
    }

    compareElements(first, second) {
        if (Rules.elements[first.element] == second.element) return 0

        return 1
    }

    nextRound() {
        if (this.currentNinja) {
            this.currentNinja.hasSelectedSpinner = false
        }
        const index = this.currentSeat
        let nextNinja = (index + 1 >= Object.keys(this.ninjas).length) ? 0 : index + 1
        this.currentSeat = nextNinja

        this.tabId = null
        this.spinAmount = between(1, 6)

        const ninjaPosition = this.currentNinja.tile

        let moveCW = (ninjaPosition + this.spinAmount) % 16
        let moveCCW = (ninjaPosition - this.spinAmount) % 16

        if (moveCCW < 0) {
            moveCCW += 16
        }

        this.moveTiles = [moveCW, moveCCW]

        for (let ninja of this.allNinjas) {
            ninja.resetTurn()
        }
    }

    sendNextRound() {
        this.setChooseBoardTimeout()

        for (let user of this.users) {
            user.send('next_round', {
                ninja: this.currentSeat,
                deck: this.ninjas[user.id].dealCards(),
                spin: {
                    amount: this.spinAmount,
                    tiles: this.moveTiles
                }
            })
        }
    }

    remove(user, quit = true) {
        const seat = this.getSeat(user)

        super.remove(user)

        const ninja = this.ninjas[user.id]

        delete this.ninjas[user.id]

        if (quit) {
            this.podium[seat] = this.finishPosition
            this.finishPosition--

            const allQuit = this.allNinjas.length === 1

            this.send('player_quit', { seat: seat, allQuit: allQuit })

            if (allQuit) {
                this.clearChooseBoardTimeout()
                this.clearChooseCardTimeout()

                const remainingNinja = this.allNinjas.find(n => n.user.id !== user.id)

                this.remove(remainingNinja.user, false)
            } else if (this.allNinjas.length >= 2) {
                if (this.getSeatByNinja(ninja) === this.currentSeat && isInRange(this.battle.state, 0, 2)) {
                    this.clearChooseBoardTimeout()
                    this.autoChooseBoard()
                } else if (!ninja.pick && this.battle.state === 3) {
                    this.autoPickCard(ninja)
                }
            }
        }
    }

}
