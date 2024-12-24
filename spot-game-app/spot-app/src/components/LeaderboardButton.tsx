import React, {useState} from 'react';
import {IonBadge, IonCard, IonModal} from '@ionic/react'
import Leaderboard from './Leaderboard';
import { ServerFacade } from './ServerFacade';

const LeaderboardButton = ({ PSDs }:any) => {

    const [open, setOpen] = useState(false)
    const closeModal = () => {
    setOpen(false)
    }

    let sortedPSDs = null;
    if(PSDs){
        sortedPSDs = PSDs.sort((a:any, b:any) => b.score - a.score);
    } else {
        sortedPSDs = [{username:"Loading..."},{username:"Loading..."},{username:"Loading..."}]
    }

    let unit = '';
    switch (ServerFacade.getGameType()){
        case 1:
            unit = '%';
            break;
        default:
            break;
    }

    return (
        <>
            <IonCard onClick={() => setOpen(true)} className='lb_section'>
                <IonBadge className='player-badge1 badges'>
                    {sortedPSDs[0]? sortedPSDs[0].username : 'N/A'}
                </IonBadge> 
                <IonBadge className='badges'>
                    {sortedPSDs[0]? sortedPSDs[0].score +unit : '0'}
                </IonBadge>
            </IonCard>
            {sortedPSDs.length >= 2 ? <IonCard onClick={() => setOpen(true)} className='lb_section'>
                <IonBadge className='player-badge2 badges'>
                    {sortedPSDs[1].username}
                </IonBadge> 
                <IonBadge className='badges'>
                    {sortedPSDs[1].score +unit}
                </IonBadge>
            </IonCard> : null }
            {sortedPSDs.length >= 3 ? <IonCard onClick={() => setOpen(true)} className='lb_section'>
                <IonBadge className='player-badge3 badges'>
                    {sortedPSDs[2].username}
                </IonBadge> 
                <IonBadge className='badges'>
                    {sortedPSDs[2].score +unit}
                </IonBadge>
            </IonCard> : null }
            <IonModal
                isOpen={open}
                onDidDismiss={closeModal}
                breakpoints={[0, 0.2, 0.5, 1]}
                initialBreakpoint={0.5}
                backdropBreakpoint={0.2}>
                {Leaderboard(sortedPSDs)}
            </IonModal>
        </>
        
    );
}

export default LeaderboardButton;