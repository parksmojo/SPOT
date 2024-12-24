import { IonButton, IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButtons, IonModal, IonItem, IonInput, IonAlert, IonIcon, IonRefresher, IonRefresherContent, RefresherEventDetail, useIonViewWillEnter, useIonModal } from '@ionic/react';
import { OverlayEventDetail } from '@ionic/core/components';
import './Menu.css';
import React, { useState, useRef } from 'react'
import { useHistory } from 'react-router-dom';
import CreateGame from '../components/CreateGame';
import { ServerFacade } from '../components/ServerFacade';
import { refresh, refreshCircleSharp, refreshSharp, warning } from 'ionicons/icons';
import GameList from '../components/GameList';
import { ScreenOrientation } from '@capacitor/screen-orientation';



const Menu: React.FC = () => {
  async function lockOrientation() {
    await ScreenOrientation.lock({ orientation: 'portrait' });
  }

  // Redirects a user to the login page if they don't have an active session
  const history = useHistory();
  if (!ServerFacade.isLoggedIn()) {
    console.log('Session not found. Routing to login.');
    history.push('/home');
  }

  const [iserror, setIsError] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [refresh, setRefresh] = useState(0);
  const [present, dismiss] = useIonModal(CreateGame, {
    dismiss: (data: string, role: string) => dismiss(data, role),
  });

  useIonViewWillEnter(() => {
    setTimeout(() => {
      setRefresh(refresh + 1);
    }, 50);
  });

  function openCreateGame() {
    present({
      onWillDismiss: (ev: CustomEvent<OverlayEventDetail>) => {
        if (ev.detail.role === 'confirm') {
          setRefresh(refresh + 1);
        }
      },
    });
  }

  async function handleLogout() {
    try {
      // Makes the request and goes to next page
      await ServerFacade.logout();
    } catch (error: any) {
      // An error is caught and displayed here.
      setIsError(true);
      setMessage(error.message + '\nRouting to the login screen');
    } finally {
      history.push('/home');
    }
  };

  function handleRefresh(event: CustomEvent<RefresherEventDetail>) {
    setTimeout(() => {
      setRefresh(refresh + 1);
      event.detail.complete();
    }, 500);
  }

  if (import.meta.env.MODE !== 'development') {
    lockOrientation();
  }
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Main Menu</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Blank</IonTitle>
          </IonToolbar>
        </IonHeader>
        <div className='game-list-card'>
          <GameList key={refresh} />
        </div>
        <IonButton color="dark" expand="block" onClick={() => openCreateGame()}>Create Game</IonButton>
        <IonButton color="dark" expand="block" onClick={() => history.push('/history')}>History</IonButton>
        <IonButton color="dark" expand="block" onClick={handleLogout}>Logout</IonButton>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}><IonRefresherContent></IonRefresherContent></IonRefresher>
        <IonAlert
          isOpen={iserror}
          onDidDismiss={() => setIsError(false)}
          header="Error"
          message={message}
          buttons={['Dismiss']}
        ></IonAlert>
      </IonContent>
    </IonPage>
  );
};

export default Menu;
