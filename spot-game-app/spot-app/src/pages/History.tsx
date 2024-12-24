import { IonButton, IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButtons, IonModal, IonItem, IonInput, IonAlert, IonIcon, IonRefresher, IonRefresherContent, RefresherEventDetail, useIonViewWillEnter, useIonModal } from '@ionic/react';
import './Menu.css';
import React, {useState, useRef} from 'react'
import { useHistory } from 'react-router-dom';
import CreateGame from '../components/CreateGame';
import { ServerFacade } from '../components/ServerFacade';
import EndedGameList from '../components/EndedGameList';
import { ScreenOrientation } from '@capacitor/screen-orientation';



const History: React.FC = () => {
  async function lockOrientation() {
    await ScreenOrientation.lock({ orientation: 'portrait' });
  }

  // Redirects a user to the login page if they don't have an active session
  const history = useHistory();
  if(!ServerFacade.isLoggedIn()){
    console.log('Session not found. Routing to login.');
    history.push('/home');
  }

  const [iserror, setIsError] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [refresh, setRefresh] = useState(0);
  const [present, dismiss] = useIonModal(CreateGame, {
    dismiss: (data: string, role: string) => dismiss(data, role),
  });


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
          <IonTitle>Games History</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Blank</IonTitle>
          </IonToolbar>
        </IonHeader>
        <div className='game-list-card'>
          <EndedGameList key={refresh}/>
        </div>
        <IonButton color= "dark" expand="block" onClick={() => history.push('/menu')}>Back</IonButton>
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

export default History;
