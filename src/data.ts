import type { AppData } from './types'

const now = new Date().toISOString()

export const initialData: AppData = {
  sermons: [
    {
      id: 'sermon-welcome',
      type: 'sermon',
      title: '감사로 다시 바라보기',
      content: '감사는 상황이 완벽하다는 선언이 아니라, 그 안에서도 함께하시는 하나님을 발견하는 믿음의 시선입니다.\n\n오늘 우리는 말씀을 통해 감사가 삶의 방향을 어떻게 바꾸는지 살펴봅니다.',
      status: '검토 중',
      scripture: '데살로니가전서 5:16-18',
      tags: ['감사', '주일예배'],
      updatedAt: now,
      audience: '장년',
      theme: '감사',
      serviceId: 'service-sunday',
    },
  ],
  prayers: [
    {
      id: 'prayer-welcome',
      type: 'prayer',
      title: '주일예배 대표기도',
      content: '사랑과 은혜가 풍성하신 하나님 아버지, 오늘도 주님의 부르심 앞에 한마음으로 예배드립니다.\n\n지난 한 주의 삶을 돌아보며 우리의 연약함을 고백하오니 새롭게 하여 주옵소서.',
      status: '초안',
      scripture: '',
      tags: ['대표기도'],
      updatedAt: now,
      prayerType: '대표기도',
      targetMinutes: 3,
      serviceId: 'service-sunday',
    },
  ],
  services: [
    {
      id: 'service-sunday',
      title: '주일예배',
      date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      time: '11:00',
      theme: '감사',
      scripture: '데살로니가전서 5:16-18',
      requiredDocuments: ['sermon', 'prayer'],
    },
  ],
  versions: [],
  usageRecords: [],
  trash: [],
  templates: [
    {
      id: 'template-sermon-basic',
      type: 'sermon',
      name: '기본 설교 구조',
      description: '서론부터 결론까지 흐름을 잡는 기본 구조',
      content: '서론\n\n본문 해설\n\n첫 번째 대지\n\n두 번째 대지\n\n삶의 적용\n\n결론',
    },
    {
      id: 'template-prayer-representative',
      type: 'prayer',
      name: '대표기도 기본 구조',
      description: '감사, 회개, 말씀, 교회와 이웃을 위한 기도',
      content: '찬양과 감사\n\n회개의 기도\n\n말씀과 예배를 위한 기도\n\n교회와 성도를 위한 기도\n\n이웃과 세상을 위한 기도\n\n맺음',
    },
  ],
  materials: [
    {
      id: 'material-welcome',
      title: '감사에 관한 묵상 메모',
      category: '본문 연구',
      content: '감사는 조건이 아니라 하나님을 바라보는 믿음의 태도라는 관점에서 본문을 정리한다.',
      tags: ['감사', '데살로니가전서'],
      updatedAt: now,
    },
  ],
  attachments: [],
}
