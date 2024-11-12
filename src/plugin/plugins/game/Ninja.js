import GamePlugin from '@plugin/GamePlugin'


export default class Ninja extends GamePlugin {

    constructor(handler) {
        super(handler)

        this.events = {
            'get_ninja': this.getNinja
        }
    }

    getNinja(args, user) {
        user.send('get_ninja', {
            rank: user.ninjaRank,
            progress: user.ninjaProgress,
            
            fire: {
                rank: user.fireRank,
                progress: user.fireProgress
            },

            cards: user.cards
        })
    }

}
