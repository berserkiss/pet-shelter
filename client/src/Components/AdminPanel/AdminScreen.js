import React from 'react'
import PostingPets from './PostingPets'
import AdoptingRequests from './AdoptingRequests'
import AdoptedHistory from './AdoptedHistory'
import ShelterManagement from './ShelterManagement'
import PetManagement from './PetManagement'
import VolunteerApplications from './VolunteerApplications'
import UserManagement from './UserManagement'

const AdminScreen = ({ activeScreen }) => {
  return (
    <div className='admin-screen-container'>
      <div className='admin-screen-content'>
        {activeScreen === 'postingPet' && <PostingPets />}
        {activeScreen === 'adoptingPet' && <AdoptingRequests />}
        {activeScreen === 'adoptedHistory' && <AdoptedHistory />}
        {activeScreen === 'shelterManagement' && <ShelterManagement />}
        {activeScreen === 'petManagement' && <PetManagement />}
        {activeScreen === 'volunteerApplications' && <VolunteerApplications />}
        {activeScreen === 'userManagement' && <UserManagement />}
      </div>
    </div>
  )
}

export default AdminScreen
